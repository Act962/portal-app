import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";
import type { PublishableImage, SocialImageSource } from "@portal-app/social";
import { PrismaSocialAccountRepository } from "@portal-app/social/infrastructure/prisma-social-account-repository";
import { PrismaSocialPostRepository } from "@portal-app/social/infrastructure/prisma-social-post-repository";
import { TokenCipher } from "@portal-app/social/infrastructure/token-cipher";
import { UnconfiguredSocialPublisher } from "@portal-app/social/infrastructure/unconfigured-social-publisher";

import { mediaDeps, mediaStorage } from "./media";

/**
 * Raiz de composição das redes sociais. Como nos demais contextos, é AQUI que a
 * infraestrutura é instanciada — o resto do app só conhece as portas.
 */
const prisma = createPrismaClient();

/**
 * Resolve um id da biblioteca na imagem que a Meta vai baixar.
 *
 * Mora na composição, e não no contexto de redes sociais, porque a resposta é
 * da MÍDIA: fazer `social` importar `media` quebraria `contextos-isolados`. É o
 * mesmo arranjo do `ContentUsage` da taxonomia e do `MediaUsage` da mídia.
 *
 * ⚠️ **O corte 1:1 ainda NÃO acontece** (fatia F4). Hoje devolve o arquivo
 * original, o que é suficiente para o Facebook e para imagens já quadradas, mas
 * o Instagram recorta sozinho — ignorando o ponto focal que a Fase 2 guarda, e
 * às vezes cortando a cabeça de quem está na foto. O `aspect` já viaja no
 * contrato para que ligar o corte seja mudar este método, e só ele.
 */
class MediaLibraryImageSource implements SocialImageSource {
	async resolve(
		mediaId: string,
		_aspect: "1:1" | "4:5" | "original",
	): Promise<PublishableImage | null> {
		const asset = await mediaDeps.repo.findById(mediaId);
		if (!asset) {
			return null;
		}
		return {
			url: mediaStorage.publicUrl(asset.storageKey),
			altText: asset.altText?.value ?? "",
		};
	}
}

/**
 * A chave de cifragem dos tokens vem do `BETTER_AUTH_SECRET` (spec 08, D9): um
 * segredo que já existe, já tem mínimo de 32 caracteres e já é tratado como
 * segredo em todo ambiente. O preço — trocá-lo obriga a reconectar as contas —
 * está documentado em `TokenCipher`.
 */
const cipher = new TokenCipher(env.BETTER_AUTH_SECRET);

export const socialAccountRepo = new PrismaSocialAccountRepository(
	prisma,
	cipher,
);

export const socialDeps = {
	repo: new PrismaSocialPostRepository(prisma),
	accounts: socialAccountRepo,
	// O adapter real da Meta chega na fatia F4. Até lá, este RECUSA e diz por
	// quê — em vez de fingir sucesso e encher a fila de posts "publicados" que
	// não existem em rede nenhuma.
	publisher: new UnconfiguredSocialPublisher(),
	images: new MediaLibraryImageSource(),
	clock: new SystemClock(),
	ids: new UuidGenerator(),
};

/** As redes que recebem o post automático de cada matéria publicada. */
export const AUTO_POST_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;
