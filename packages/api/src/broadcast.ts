import { PrismaProgramRepository } from "@portal-app/broadcast/infrastructure/prisma-program-repository";
import { createPrismaClient } from "@portal-app/db";
import { UuidGenerator } from "@portal-app/shared-kernel";

/**
 * Raiz de composição da programação no lado servidor. Como em `taxonomy.ts` e
 * `staff.ts`, é AQUI (camada de API) que a infraestrutura do contexto é
 * instanciada, para o app consumir só isto — mantendo `infra-nao-vaza`
 * satisfeito.
 */
const prisma = createPrismaClient();

export const programDeps = {
	repo: new PrismaProgramRepository(prisma),
	ids: new UuidGenerator(),
};
