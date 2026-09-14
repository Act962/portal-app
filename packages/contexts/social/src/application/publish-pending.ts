import type { Clock } from "@portal-app/shared-kernel";

import { PLATFORM_LABEL, type SocialPlatform } from "../domain/platform";
import type { SocialAccountRepository } from "../domain/ports/social-account-repository";
import type { SocialPostRepository } from "../domain/ports/social-post-repository";
import type {
	PublishableImage,
	SocialImageSource,
	SocialPublisher,
} from "../domain/ports/social-publisher";
import type { SocialPost } from "../domain/social-post";

export type PublishPendingDeps = {
	repo: SocialPostRepository;
	accounts: SocialAccountRepository;
	publisher: SocialPublisher;
	images: SocialImageSource;
	clock: Clock;
};

export type PublishPendingResult = {
	posts: number;
	published: number;
	failed: number;
};

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
	let published = 0;
	let failed = 0;

	for (const post of posts) {
		for (const delivery of [...post.pendingDeliveries()]) {
			const outcome = await deliver(post, delivery.platform, deps);
			if (outcome) {
				published += 1;
			} else {
				failed += 1;
			}
			// Uma gravação por entrega — ver o porquê no cabeçalho.
			await deps.repo.save(post);
		}
	}

	return { posts: posts.length, published, failed };
}

/** Devolve `true` se a rede aceitou. */
async function deliver(
	post: SocialPost,
	platform: SocialPlatform,
	deps: PublishPendingDeps,
): Promise<boolean> {
	const now = deps.clock.now();
	const label = PLATFORM_LABEL[platform];

	const account = await deps.accounts.findByPlatform(platform);
	if (!account) {
		post.recordFailure(
			platform,
			`Nenhuma conta do ${label} está conectada ao portal.`,
			now,
		);
		return false;
	}
	if (!account.isUsableAt(now)) {
		post.recordFailure(
			platform,
			`A conta do ${label} não pode publicar: ${account.unusableReasonAt(now)}.`,
			now,
		);
		return false;
	}

	const images = await resolveImages(post, deps);
	if (images === null) {
		post.recordFailure(
			platform,
			"Uma das imagens não está mais na biblioteca de mídia.",
			now,
		);
		return false;
	}

	const result = await deps.publisher.publish({
		platform,
		accountRemoteId: account.remoteId,
		// A legenda como ela sai NESTA rede — o link entra só onde é clicável.
		caption: post.captionFor(platform),
		images,
		linkUrl: post.linkUrl,
	});

	if (result.isErr()) {
		const failure = result.unwrapErr();
		post.recordFailure(platform, failure.reason, now);
		return false;
	}

	const success = result.unwrap();
	post.recordSuccess(platform, success.remoteId, success.permalink, now);
	return true;
}

/**
 * Resolve os ids da biblioteca nas imagens que a Meta vai baixar.
 *
 * `1:1` porque é o corte do feed e o que o cliente pediu (D3). Devolve `null`
 * se qualquer uma sumiu — publicar um carrossel com um buraco no meio seria
 * pior do que não publicar, e a mensagem diz o que houve.
 */
async function resolveImages(
	post: SocialPost,
	deps: PublishPendingDeps,
): Promise<readonly PublishableImage[] | null> {
	const images: PublishableImage[] = [];
	for (const mediaId of post.mediaIds) {
		const image = await deps.images.resolve(mediaId, "1:1");
		if (!image) {
			return null;
		}
		images.push(image);
	}
	return images;
}
