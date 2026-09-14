import { err, ok, type Result } from "@portal-app/shared-kernel";

import { PLATFORM_LABEL, type SocialPlatform } from "../../domain/platform";
import type { AccountCredentials } from "../../domain/ports/social-account-repository";
import type {
	PublishableImage,
	PublishFailure,
	PublishRequest,
	PublishSuccess,
	SocialPublisher,
} from "../../domain/ports/social-publisher";
import type { GraphError, MetaGraphClient } from "./graph-client";
import { toPublishFailure } from "./graph-errors";

export type MetaPublisherDeps = {
	client: MetaGraphClient;
	/** De onde vem o token, no instante da chamada — nunca guardado aqui. */
	credentialsFor: (
		platform: SocialPlatform,
	) => Promise<AccountCredentials | null>;
	/** Injetado para o teste não esperar de verdade. */
	sleep?: (ms: number) => Promise<void>;
	/** Quantas vezes perguntar pelo processamento do container. */
	pollAttempts?: number;
	pollIntervalMs?: number;
};

type IdResponse = { id: string };
type PhotoResponse = { id: string; post_id?: string };
type StatusResponse = { status_code?: string };

/**
 * O adapter real da porta `SocialPublisher`: Instagram e Página do Facebook
 * pela Graph API (spec 08, §6.5).
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

	constructor(private readonly deps: MetaPublisherDeps) {
		this.sleep =
			deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		// 12 × 5 s = 1 minuto. A Meta recomenda consultar por até 5 minutos, mas
		// esta espera roda dentro de uma tarefa agendada com teto de duração, e foto
		// costuma ficar pronta em segundos. Se não ficar, a entrega falha como
		// REPETÍVEL e a próxima rodada tenta com um container novo.
		this.pollAttempts = deps.pollAttempts ?? 12;
		this.pollIntervalMs = deps.pollIntervalMs ?? 5000;
	}

	async publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const label = PLATFORM_LABEL[request.platform];

		if (request.images.length === 0) {
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

		return request.platform === "INSTAGRAM"
			? this.publishInstagram(request, credentials.accessToken)
			: this.publishFacebook(request, credentials.accessToken);
	}

	// ── Instagram ──────────────────────────────────────────────────────────────

	private async publishInstagram(
		request: PublishRequest,
		token: string,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		const igId = request.accountRemoteId;
		const { client } = this.deps;

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

		const ready = await this.waitUntilFinished(creationId, token);
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
			permalink: await this.permalink(mediaId, "permalink", token),
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
	): Promise<Result<void, PublishFailure>> {
		for (let attempt = 0; attempt < this.pollAttempts; attempt += 1) {
			const status = await this.deps.client.get<StatusResponse>(
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
						reason:
							"O Instagram não conseguiu processar a imagem. Confira se ela é um JPEG válido e tente outra.",
						retryable: false,
						providerCode: "CONTAINER_ERROR",
					});
				case "EXPIRED":
					return err({
						reason:
							"O Instagram descartou o envio antes de publicar. A publicação será tentada de novo.",
						retryable: true,
						providerCode: "CONTAINER_EXPIRED",
					});
				default:
					await this.sleep(this.pollIntervalMs);
			}
		}
		return err({
			reason:
				"O Instagram ainda está processando a imagem. A publicação será tentada de novo.",
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
				permalink: await this.permalink(postId, "permalink_url", token),
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
			permalink: await this.permalink(postId, "permalink_url", token),
		});
	}

	// ── comum ──────────────────────────────────────────────────────────────────

	/**
	 * O link público do post. **Falhar aqui não falha a publicação**: o post já
	 * está no ar, e transformar "não consegui o link" em erro faria o worker
	 * reenviar — duplicando o post por causa de um campo cosmético.
	 */
	private async permalink(
		id: string,
		field: "permalink" | "permalink_url",
		token: string,
	): Promise<string | null> {
		const result = await this.deps.client.get<Record<string, string>>(
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
