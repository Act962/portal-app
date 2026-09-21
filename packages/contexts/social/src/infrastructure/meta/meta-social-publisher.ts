import { err, ok, type Result } from "@portal-app/shared-kernel";

import { PLATFORM_LABEL, type SocialPlatform } from "../../domain/platform";
import type { AccountCredentials } from "../../domain/ports/social-account-repository";
import type {
	PublishableImage,
	PublishableVideo,
	PublishFailure,
	PublishRequest,
	PublishSuccess,
	SocialPublisher,
} from "../../domain/ports/social-publisher";
import type { GraphError, MetaGraphClient } from "./graph-client";
import { toPublishFailure } from "./graph-errors";
import { readInstagramQuota } from "./publishing-quota";

export type MetaPublisherDeps = {
	client: MetaGraphClient;
	/**
	 * O cliente das chamadas do INSTAGRAM, quando ele usa outro host.
	 *
	 * Com o token do login do Instagram (o do `.env`, §15), as mesmas rotas —
	 * `/media`, `/media_publish`, status do container, cota — são servidas por
	 * `graph.instagram.com`. Sem este campo, o Instagram usa `client`
	 * (`graph.facebook.com`, token de Página).
	 */
	instagramClient?: MetaGraphClient;
	/** De onde vem o token, no instante da chamada — nunca guardado aqui. */
	credentialsFor: (
		platform: SocialPlatform,
	) => Promise<AccountCredentials | null>;
	/** Injetado para o teste não esperar de verdade. */
	sleep?: (ms: number) => Promise<void>;
	/** Quantas vezes perguntar pelo processamento do container. */
	pollAttempts?: number;
	pollIntervalMs?: number;
	/**
	 * O mesmo, para VÍDEO. Separado porque a ordem de grandeza é outra: a Meta
	 * transcodifica um Reels de um minuto em minutos, não em segundos, e usar a
	 * espera da foto faria toda entrega de vídeo morrer no tempo limite e voltar
	 * para a fila — criando um container novo a cada rodada e nunca publicando.
	 */
	videoPollAttempts?: number;
	videoPollIntervalMs?: number;
	/** Consultar a cota do Instagram antes de publicar (D13). Padrão: sim. Só o
	 * teste da sequência de chamadas desliga, para não repetir a consulta em
	 * cada roteiro. */
	checkQuota?: boolean;
};

type IdResponse = { id: string };
type PhotoResponse = { id: string; post_id?: string };
type StatusResponse = { status_code?: string };

/**
 * O adapter real da porta `SocialPublisher`: Instagram e Página do Facebook
 * pela Graph API (spec 08, §6.5), no feed e nos Stories do Instagram (§17).
 *
 * É o **único arquivo** do sistema que conhece container, `creation_id`,
 * `media_publish` e `attached_media`. Nenhum caso de uso sabe que publicar no
 * Instagram custa duas chamadas (ou N+2, no carrossel) e uma espera de
 * processamento — é isso que a porta prometia, e é isso que permite trocar este
 * arquivo sem tocar em regra nenhuma.
 */
export class MetaSocialPublisher implements SocialPublisher {
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly pollAttempts: number;
	private readonly pollIntervalMs: number;
	private readonly videoPollAttempts: number;
	private readonly videoPollIntervalMs: number;

	constructor(private readonly deps: MetaPublisherDeps) {
		this.sleep =
			deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		// 12 × 5 s = 1 minuto. A Meta recomenda consultar por até 5 minutos, mas
		// esta espera roda dentro de uma tarefa agendada com teto de duração, e foto
		// costuma ficar pronta em segundos. Se não ficar, a entrega falha como
		// REPETÍVEL e a próxima rodada tenta com um container novo.
		this.pollAttempts = deps.pollAttempts ?? 12;
		this.pollIntervalMs = deps.pollIntervalMs ?? 5000;
		// 30 × 5 s = 2,5 minutos, dentro dos 5 minutos que a Meta recomenda.
		this.videoPollAttempts = deps.videoPollAttempts ?? 30;
		this.videoPollIntervalMs = deps.videoPollIntervalMs ?? 5000;
	}

	private get instagram(): MetaGraphClient {
		return this.deps.instagramClient ?? this.deps.client;
	}

	async publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const label = PLATFORM_LABEL[request.platform];

		const video = request.video ?? null;

		// As guardas de FORMATO vêm primeiro, e a ordem importa para a mensagem:
		// um Reels sem vídeo precisa dizer que falta o vídeo, não que "não tem
		// imagem" — a pessoa que lê o erro na fila é quem vai atrás do arquivo.
		//
		// O domínio não oferece Stories nem Reels do Facebook; estas existem para
		// quem chamar a porta direto não receber um post de feed no lugar.
		if (request.format !== "FEED" && request.platform !== "INSTAGRAM") {
			const what = request.format === "REEL" ? "Reels" : "Stories";
			return err({
				reason: `Esta integração não publica ${what} no ${label}.`,
				retryable: false,
				providerCode: `${what === "Reels" ? "REEL" : "STORY"}_UNSUPPORTED`,
			});
		}
		if (video && request.platform !== "INSTAGRAM") {
			return err({
				reason: `Esta integração não publica vídeo no ${label}.`,
				retryable: false,
				providerCode: "VIDEO_UNSUPPORTED",
			});
		}
		if (request.format === "REEL" && !video) {
			return err({
				reason: "O Reels precisa de um vídeo.",
				retryable: false,
				providerCode: "VIDEO_REQUIRED",
			});
		}
		if (!video && request.images.length === 0) {
			return err({
				reason: `A publicação para o ${label} não tem imagem.`,
				retryable: false,
			});
		}

		const credentials = await this.deps.credentialsFor(request.platform);
		if (!credentials) {
			return err({
				reason: `Nenhuma conta do ${label} está conectada ao portal.`,
				retryable: false,
			});
		}

		if (request.platform === "FACEBOOK") {
			return this.publishFacebook(request, credentials.accessToken);
		}
		if (request.format === "REEL") {
			return this.publishInstagramReel(
				request,
				video as PublishableVideo,
				credentials.accessToken,
			);
		}
		if (request.format === "STORY") {
			return video
				? this.publishInstagramStoryVideo(
						request,
						video,
						credentials.accessToken,
					)
				: this.publishInstagramStory(request, credentials.accessToken);
		}
		return this.publishInstagram(request, credentials.accessToken);
	}

	// ── Instagram ──────────────────────────────────────────────────────────────

	private async publishInstagram(
		request: PublishRequest,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const igId = request.accountRemoteId;
		const client = this.instagram;

		const blocked = await this.quotaFailure(igId, token);
		if (blocked) {
			return err(blocked);
		}

		let creationId: string;

		if (request.images.length === 1) {
			const [image] = request.images as [PublishableImage];
			const container = await client.post<IdResponse>(
				`${igId}/media`,
				{ image_url: image.url, caption: request.caption },
				token,
			);
			if (container.isErr()) {
				return this.fail(container.unwrapErr(), "INSTAGRAM");
			}
			creationId = container.unwrap().id;
		} else {
			// Carrossel: um container por imagem, cada um marcado como item…
			const children: string[] = [];
			for (const image of request.images) {
				const child = await client.post<IdResponse>(
					`${igId}/media`,
					{ image_url: image.url, is_carousel_item: true },
					token,
				);
				if (child.isErr()) {
					return this.fail(child.unwrapErr(), "INSTAGRAM");
				}
				const ready = await this.waitUntilFinished(child.unwrap().id, token);
				if (ready.isErr()) {
					return err(ready.unwrapErr());
				}
				children.push(child.unwrap().id);
			}
			// …e o container do carrossel, que é quem leva a legenda.
			const carousel = await client.post<IdResponse>(
				`${igId}/media`,
				{
					media_type: "CAROUSEL",
					children: children.join(","),
					caption: request.caption,
				},
				token,
			);
			if (carousel.isErr()) {
				return this.fail(carousel.unwrapErr(), "INSTAGRAM");
			}
			creationId = carousel.unwrap().id;
		}

		return this.publishContainer(igId, creationId, token);
	}

	/**
	 * Story: um container `media_type=STORIES` com UMA imagem, sem legenda.
	 *
	 * A imagem já chega em 1080×1920 (o `SocialImageSource` a monta com a foto
	 * inteira sobre o fundo desfocado); aqui só se publica. A cota é a mesma do
	 * feed — story publicado por API conta no limite de 24 h da conta.
	 */
	private async publishInstagramStory(
		request: PublishRequest,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const igId = request.accountRemoteId;

		const blocked = await this.quotaFailure(igId, token);
		if (blocked) {
			return err(blocked);
		}

		const [image] = request.images as [PublishableImage];
		const container = await this.instagram.post<IdResponse>(
			`${igId}/media`,
			{ media_type: "STORIES", image_url: image.url },
			token,
		);
		if (container.isErr()) {
			return this.fail(container.unwrapErr(), "INSTAGRAM");
		}

		return this.publishContainer(igId, container.unwrap().id, token);
	}

	/**
	 * Reels: um container `media_type=REELS` com o vídeo e a legenda.
	 *
	 * `share_to_feed` é o que faz o Reels aparecer TAMBÉM na grade do perfil —
	 * sem ele, o vídeo sai só na aba de Reels, e a matéria some do lugar onde o
	 * leitor do portal costuma procurá-la. É por isso que não existe aqui um
	 * "feed em vídeo" separado: esta chamada já é os dois.
	 */
	private async publishInstagramReel(
		request: PublishRequest,
		video: PublishableVideo,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const igId = request.accountRemoteId;

		const blocked = await this.quotaFailure(igId, token);
		if (blocked) {
			return err(blocked);
		}

		const container = await this.instagram.post<IdResponse>(
			`${igId}/media`,
			{
				media_type: "REELS",
				video_url: video.url,
				caption: request.caption,
				share_to_feed: "true",
				...(video.coverUrl ? { cover_url: video.coverUrl } : {}),
			},
			token,
		);
		if (container.isErr()) {
			return this.fail(container.unwrapErr(), "INSTAGRAM");
		}

		return this.publishContainer(igId, container.unwrap().id, token, true);
	}

	/** Story em vídeo: `media_type=STORIES` com `video_url`, sem legenda. */
	private async publishInstagramStoryVideo(
		request: PublishRequest,
		video: PublishableVideo,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const igId = request.accountRemoteId;

		const blocked = await this.quotaFailure(igId, token);
		if (blocked) {
			return err(blocked);
		}

		const container = await this.instagram.post<IdResponse>(
			`${igId}/media`,
			{ media_type: "STORIES", video_url: video.url },
			token,
		);
		if (container.isErr()) {
			return this.fail(container.unwrapErr(), "INSTAGRAM");
		}

		return this.publishContainer(igId, container.unwrap().id, token, true);
	}

	/**
	 * A cota é LIDA da conta, não cravada (D13). Esgotada, nem cria container: a
	 * Meta recusaria o `media_publish` depois de a imagem já ter sido
	 * processada. Não é repetível pelo worker — a cota volta em horas, não nos
	 * quinze minutos das tentativas automáticas.
	 */
	private async quotaFailure(
		igId: string,
		token: string,
	): Promise<PublishFailure | null> {
		if (!(this.deps.checkQuota ?? true)) {
			return null;
		}
		const quota = await readInstagramQuota(this.instagram, igId, token);
		if (quota && quota.used >= quota.total) {
			return {
				reason: `O Instagram atingiu o limite de ${quota.total} publicações em 24 horas. Tente de novo mais tarde.`,
				retryable: false,
				providerCode: "QUOTA_EXCEEDED",
			};
		}
		return null;
	}

	/** Espera o container terminar, publica e busca o link — igual para foto,
	 * carrossel e story. */
	private async publishContainer(
		igId: string,
		creationId: string,
		token: string,
		video = false,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const client = this.instagram;

		const ready = await this.waitUntilFinished(creationId, token, video);
		if (ready.isErr()) {
			return err(ready.unwrapErr());
		}

		const published = await client.post<IdResponse>(
			`${igId}/media_publish`,
			{ creation_id: creationId },
			token,
		);
		if (published.isErr()) {
			return this.fail(published.unwrapErr(), "INSTAGRAM");
		}

		const mediaId = published.unwrap().id;
		return ok({
			remoteId: mediaId,
			permalink: await this.permalink(client, mediaId, "permalink", token),
		});
	}

	/**
	 * Espera o container sair de `IN_PROGRESS`.
	 *
	 * Publicar um container que ainda não terminou devolve erro da Meta — e,
	 * pior, às vezes devolve depois de consumir a tentativa. Perguntar antes é o
	 * que a documentação manda.
	 */
	private async waitUntilFinished(
		containerId: string,
		token: string,
		video = false,
	): Promise<Result<void, PublishFailure>> {
		const attempts = video ? this.videoPollAttempts : this.pollAttempts;
		const interval = video ? this.videoPollIntervalMs : this.pollIntervalMs;
		const what = video ? "o vídeo" : "a imagem";
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			const status = await this.instagram.get<StatusResponse>(
				containerId,
				{ fields: "status_code" },
				token,
			);
			if (status.isErr()) {
				return this.fail(status.unwrapErr(), "INSTAGRAM");
			}
			switch (status.unwrap().status_code) {
				case "FINISHED":
				case "PUBLISHED":
					return ok(undefined);
				case "ERROR":
					return err({
						reason: video
							? "O Instagram não conseguiu processar o vídeo. Confira a duração e o formato e tente de novo."
							: "O Instagram não conseguiu processar a imagem. Confira se ela é um JPEG válido e tente outra.",
						retryable: false,
						providerCode: "CONTAINER_ERROR",
					});
				case "EXPIRED":
					return err({
						reason: "O Instagram descartou o envio antes de publicar.",
						retryable: true,
						providerCode: "CONTAINER_EXPIRED",
					});
				default:
					await this.sleep(interval);
			}
		}
		return err({
			reason: `O Instagram ainda estava processando ${what} quando o tempo de espera acabou.`,
			retryable: true,
			providerCode: "CONTAINER_TIMEOUT",
		});
	}

	// ── Facebook ───────────────────────────────────────────────────────────────

	private async publishFacebook(
		request: PublishRequest,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const pageId = request.accountRemoteId;
		const { client } = this.deps;

		if (request.images.length === 1) {
			const [image] = request.images as [PublishableImage];
			const photo = await client.post<PhotoResponse>(
				`${pageId}/photos`,
				{
					url: image.url,
					caption: request.caption,
					...(image.altText ? { alt_text_custom: image.altText } : {}),
				},
				token,
			);
			if (photo.isErr()) {
				return this.fail(photo.unwrapErr(), "FACEBOOK");
			}
			// A foto publicada gera um POST na Página; é ele que tem link público.
			const postId = photo.unwrap().post_id ?? photo.unwrap().id;
			return ok({
				remoteId: postId,
				permalink: await this.permalink(client, postId, "permalink_url", token),
			});
		}

		// Várias imagens: sobe cada uma SEM publicar e junta num post só. Publicar
		// uma a uma criaria N posts soltos na Página em vez de um álbum.
		const mediaIds: string[] = [];
		for (const image of request.images) {
			const photo = await client.post<PhotoResponse>(
				`${pageId}/photos`,
				{
					url: image.url,
					published: false,
					...(image.altText ? { alt_text_custom: image.altText } : {}),
				},
				token,
			);
			if (photo.isErr()) {
				return this.fail(photo.unwrapErr(), "FACEBOOK");
			}
			mediaIds.push(photo.unwrap().id);
		}

		const attached: Record<string, string> = {};
		mediaIds.forEach((mediaFbid, index) => {
			attached[`attached_media[${index}]`] = JSON.stringify({
				media_fbid: mediaFbid,
			});
		});

		const post = await client.post<IdResponse>(
			`${pageId}/feed`,
			{ message: request.caption, ...attached },
			token,
		);
		if (post.isErr()) {
			return this.fail(post.unwrapErr(), "FACEBOOK");
		}

		const postId = post.unwrap().id;
		return ok({
			remoteId: postId,
			permalink: await this.permalink(client, postId, "permalink_url", token),
		});
	}

	// ── comum ──────────────────────────────────────────────────────────────────

	/**
	 * O link público do post. **Falhar aqui não falha a publicação**: o post já
	 * está no ar, e transformar "não consegui o link" em erro faria o worker
	 * reenviar — duplicando o post por causa de um campo cosmético.
	 */
	private async permalink(
		client: MetaGraphClient,
		id: string,
		field: "permalink" | "permalink_url",
		token: string,
	): Promise<string | null> {
		const result = await client.get<Record<string, string>>(
			id,
			{ fields: field },
			token,
		);
		return result.isOk() ? (result.unwrap()[field] ?? null) : null;
	}

	private fail<T>(
		error: GraphError,
		platform: SocialPlatform,
	): Result<T, PublishFailure> {
		return err(toPublishFailure(error, platform));
	}
}
