import { createPrismaClient } from "@portal-app/db";
import { PrismaPollRepository } from "@portal-app/polls/infrastructure/prisma-poll-repository";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";

/**
 * Raiz de composição das enquetes. Como nos demais contextos, é AQUI que a
 * infraestrutura é instanciada — o resto do app só conhece as portas.
 */
const prisma = createPrismaClient();

export const pollDeps = {
	repo: new PrismaPollRepository(prisma),
	ids: new UuidGenerator(),
	clock: new SystemClock(),
};
