import { PrismaColumnistRepository } from "@portal-app/columnists/infrastructure/prisma-columnist-repository";
import { createPrismaClient } from "@portal-app/db";
import { UuidGenerator } from "@portal-app/shared-kernel";

/**
 * Raiz de composição dos colunistas no lado servidor. Como em `broadcast.ts` e
 * `taxonomy.ts`, é AQUI (camada de API) que a infraestrutura do contexto é
 * instanciada, para o app consumir só isto — mantendo `infra-nao-vaza`
 * satisfeito.
 */
const prisma = createPrismaClient();

export const columnistDeps = {
	repo: new PrismaColumnistRepository(prisma),
	ids: new UuidGenerator(),
};
