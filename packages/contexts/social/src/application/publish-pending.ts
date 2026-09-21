import type { Clock } from "@portal-app/shared-kernel";

import type { CropAspect } from "../domain/focal-crop";
import {
	DESTINATION_FORMAT,
	DESTINATION_PLATFORM,
	PLATFORM_LABEL,
	PLATFORM_LIMITS,
	type SocialDestination,
} from "../domain/platform";
import type { SocialAccountRepository } from "../domain/ports/social-account-repository";
import type { SocialPostRepository } from "../domain/ports/social-post-repository";
import type {
	PublishableImage,
	PublishableVideo,
	SocialImageSource,
	SocialPublisher,
	SocialVideoSource,
} from "../domain/ports/social-publisher";
import { mediaUrlProblem } from "../domain/public-media-url";
import type { SocialPost } from "../domain/social-post";
import {
	type ArtSelection,
	plainSelection,
} from "../domain/template/art-selection";
import { formatsFor } from "../domain/template/art-template";

export type PublishPendingDeps = {
	repo: SocialPostRepository;
	accounts: SocialAccountRepository;
	publisher: SocialPublisher;
	images: SocialImageSource;
	/** Monta o vídeo dentro do padrão (spec 12). */
	videos: SocialVideoSource;
	clock: Clock;
};

export type PublishPendingResult = {
	posts: number;
	published: number;
	/** Entregas manuais com a arte pronta, esperando uma pessoa (spec 11). */
	prepared: number;
	/** Falhas definitivas: a entrega saiu da fila e espera uma pessoa. */
	failed: number;
	/** Falhas passageiras: a entrega continua na fila para a próxima rodada. */
	retrying: number;
};

type Outcome = "published" | "prepared" | "failed" | "retrying";

/** A mensagem de quando a foto (ou outra imagem) não pode mais ser lida. */
export const MISSING_IMAGE_REASON =
	"Uma das imagens não está mais na biblioteca de mídia ou no armazenamento.";

/** A mesma coisa, para vídeo — o arquivo sumiu, ou não é vídeo. */
export const MISSING_VIDEO_REASON =
	"O vídeo não está mais na biblioteca de mídia ou no armazenamento.";

/**
 * Quantos posts uma rodada tenta.
 *
 * O teto não é sobre desempenho: a Meta limita publicações por conta em 24 h, e
 * uma rodada sem freio queimaria a cota inteira numa fila represada. Dez por
 * rodada, a cada cinco minutos, dá 120 por hora de capacidade — muito acima do
 * que um portal local produz, e ainda assim um teto.
 */
const BATCH_SIZE = 10;

/**
 * O worker: pega os posts aprovados e os entrega às redes.
 *
 * **Roda fora da requisição HTTP**, dirigido pelo agendador (ADR 0007), e é
 * isso que o `approvePost` compra ao só trancar o post: o painel responde na
 * hora, e a lentidão da Meta — que pode levar minutos processando um carrossel
 * — não vira timeout na tela de ninguém.
 *
 * **Cada entrega é salva assim que resolve.** Não há um `save` no fim: se o
 * processo morrer entre o Instagram e o Facebook, o que já saiu está gravado
 * com seu `remoteId`, e a próxima rodada não o reenvia. Salvar só no fim
 * transformaria uma queda em post duplicado.
 */
export async function publishPendingPosts(
	deps: PublishPendingDeps,
	batchSize: number = BATCH_SIZE,
): Promise<PublishPendingResult> {
	const posts = await deps.repo.listAwaitingDelivery(batchSize);
	const totals: Record<Outcome, number> = {
		published: 0,
		prepared: 0,
		failed: 0,
		retrying: 0,
	};

	for (const post of posts) {
		for (const delivery of [...post.pendingDeliveries()]) {
			totals[await deliver(post, delivery.destination, deps)] += 1;
			// Uma gravação por entrega — ver o porquê no cabeçalho.
			await deps.repo.save(post);
		}
	}

	return { posts: posts.length, ...totals };
}

async function deliver(
	post: SocialPost,
	destination: SocialDestination,
	deps: PublishPendingDeps,
): Promise<Outcome> {
	const now = deps.clock.now();
	// A CONTA é da rede: o feed e os Stories do Instagram publicam com a mesma.
	const platform = DESTINATION_PLATFORM[destination];
	const label = PLATFORM_LABEL[platform];

	if (post.deliveryFor(destination)?.isManual()) {
		return prepare(post, destination, deps);
	}

	const account = await deps.accounts.findByPlatform(platform);
	if (!account) {
		post.recordFailure(
			destination,
			`Nenhuma conta do ${label} está conectada ao portal.`,
			now,
		);
		return "failed";
	}
	if (!account.isUsableAt(now)) {
		post.recordFailure(
			destination,
			`A conta do ${label} não pode publicar: ${account.unusableReasonAt(now)}.`,
			now,
		);
		return "failed";
	}

	const media = await mediaFor(post, destination, deps);
	if (media === null) {
		post.recordFailure(
			destination,
			post.isVideo ? MISSING_VIDEO_REASON : MISSING_IMAGE_REASON,
			now,
		);
		return "failed";
	}

	// A Meta BAIXA o arquivo. Endereço interno (o MinIO de dev) morreria lá do
	// outro lado com um erro genérico; aqui a causa sai em português, antes de
	// gastar a chamada.
	for (const url of urlsOf(media)) {
		const problem = mediaUrlProblem(url);
		if (problem) {
			post.recordFailure(
				destination,
				`O ${label} não consegue baixar ${media.video ? "o vídeo" : "a imagem"}: ${problem}.`,
				now,
			);
			return "failed";
		}
	}

	const result = await deps.publisher.publish({
		platform,
		format: DESTINATION_FORMAT[destination],
		accountRemoteId: account.remoteId,
		// A legenda como ela sai NESTE destino — o link entra só onde é clicável,
		// e nos Stories não há legenda.
		caption: post.captionFor(destination),
		images: media.images,
		video: media.video,
		linkUrl: post.linkUrl,
	});

	if (result.isErr()) {
		const failure = result.unwrapErr();
		post.recordFailure(destination, failure.reason, now, {
			retryable: failure.retryable,
		});
		return post.deliveryFor(destination)?.isPending() ? "retrying" : "failed";
	}

	const success = result.unwrap();
	post.recordSuccess(destination, success.remoteId, success.permalink, now);
	return "published";
}

/**
 * Prepara a entrega MANUAL (spec 11, D5): desenha a mesma imagem que sairia
 * pela API e a deixa esperando uma pessoa.
 *
 * Não pede conta conectada nem confere se a Meta alcança a URL: quem baixa a
 * imagem é o celular de quem publica, e a API nem entra na história. A foto que
 * sumiu falha AQUI, com a mesma mensagem do automático — melhor do que a pessoa
 * descobrir no celular.
 */
async function prepare(
	post: SocialPost,
	destination: SocialDestination,
	deps: PublishPendingDeps,
): Promise<Outcome> {
	const now = deps.clock.now();
	const media = await mediaFor(post, destination, deps);
	// No story em vídeo, o que a pessoa baixa é o VÍDEO montado — o mesmo
	// arquivo que a API publicaria, se a figurinha de link não exigisse o app.
	const url = media?.video?.url ?? media?.images[0]?.url;
	if (!url) {
		post.recordFailure(
			destination,
			post.isVideo ? MISSING_VIDEO_REASON : MISSING_IMAGE_REASON,
			now,
		);
		return "failed";
	}
	post.recordPrepared(destination, url, now);
	return "prepared";
}

/** O que vai para a rede: imagens, ou um vídeo. Nunca os dois. */
type DeliveryMedia = {
	images: readonly PublishableImage[];
	video: PublishableVideo | null;
};

function urlsOf(media: DeliveryMedia): string[] {
	return media.video
		? [media.video.url, ...(media.video.coverUrl ? [media.video.coverUrl] : [])]
		: media.images.map((image) => image.url);
}

/**
 * O arquivo do destino. `null` quando ele sumiu, e a entrega falha dizendo isso.
 *
 * Num post de VÍDEO é sempre um só: o trecho escolhido montado dentro do
 * padrão. Sem padrão para o destino, o quadro vazio (`plainSelection`) — o
 * vídeo sai enquadrado no formato da rede, que é o que "publicar sem arte"
 * quer dizer.
 *
 * Num post de FOTO, o de antes: com padrão, a arte; sem padrão, a foto cortada
 * (spec 09, F5).
 */
async function mediaFor(
	post: SocialPost,
	destination: SocialDestination,
	deps: PublishPendingDeps,
): Promise<DeliveryMedia | null> {
	const selection = post.artFor(destination);

	if (post.isVideo) {
		const video = await deps.videos.artwork({
			selection:
				selection ?? plainSelection(formatsFor(destination)[0] ?? "9:16"),
			photoMediaId: post.mediaIds[0] ?? null,
			content: post.artContentForDrawing(),
			clips: post.clips,
		});
		return video ? { images: [], video } : null;
	}

	const images = selection
		? await artworkImages(post, selection, deps)
		: await resolveImages(
				post.imagesFor(destination),
				PLATFORM_LIMITS[destination].imageAspect,
				deps,
			);
	return images ? { images, video: null } : null;
}

/**
 * A arte do padrão, desenhada com a PRIMEIRA foto do post — a capa. Um
 * carrossel com padrão sai como uma arte só: o desenho tem uma caixa de foto.
 * `null` quando a foto sumiu, e a entrega falha dizendo isso.
 */
async function artworkImages(
	post: SocialPost,
	selection: ArtSelection,
	deps: PublishPendingDeps,
): Promise<readonly PublishableImage[] | null> {
	const image = await deps.images.artwork({
		selection,
		photoMediaId: post.mediaIds[0] ?? null,
		content: post.artContentForDrawing(),
	});
	return image ? [image] : null;
}

/**
 * Resolve os ids da biblioteca nas imagens que a Meta vai baixar.
 *
 * A proporção vem do destino: `1:1` no feed (D3), `9:16` no story. Devolve
 * `null` se qualquer uma sumiu — publicar um carrossel com um buraco no meio
 * seria pior do que não publicar, e a mensagem diz o que houve.
 */
async function resolveImages(
	mediaIds: readonly string[],
	aspect: CropAspect,
	deps: PublishPendingDeps,
): Promise<readonly PublishableImage[] | null> {
	const images: PublishableImage[] = [];
	for (const mediaId of mediaIds) {
		const image = await deps.images.resolve(mediaId, aspect);
		if (!image) {
			return null;
		}
		images.push(image);
	}
	return images;
}
