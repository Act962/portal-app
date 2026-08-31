import {
	PrismaAdSenseSettingsRepository,
	PrismaAdStatsCounter,
	PrismaCampaignRepository,
} from "@portal-app/advertising/infrastructure/prisma-campaign-repository";
import { createPrismaClient } from "@portal-app/db";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";

/**
 * Raiz de composição da publicidade. Como nos demais contextos, é AQUI que a
 * infraestrutura é instanciada — o resto do app só conhece as portas.
 */
const prisma = createPrismaClient();
const ids = new UuidGenerator();

export const adDeps = {
	repo: new PrismaCampaignRepository(prisma),
	settings: new PrismaAdSenseSettingsRepository(prisma),
	// O contador precisa gerar id para a linha do dia que ainda não existe. Ele
	// recebe a FUNÇÃO, e não o gerador, para o adapter não conhecer a porta
	// `IdGenerator` inteira só por causa disso.
	stats: new PrismaAdStatsCounter(prisma, () => ids.generate()),
	ids,
	clock: new SystemClock(),
};
