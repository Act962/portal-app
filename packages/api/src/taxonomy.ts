import { createPrismaClient } from "@portal-app/db";
import { UuidGenerator } from "@portal-app/shared-kernel";
import { PrismaSectionRepository } from "@portal-app/taxonomy/infrastructure/prisma-section-repository";
import { PrismaTagRepository } from "@portal-app/taxonomy/infrastructure/prisma-tag-repository";

import { contentUsage } from "./editorial";

/**
 * Raiz de composição da taxonomia no lado servidor. Como em `staff.ts`, é AQUI
 * (camada de API) que a infraestrutura do contexto é instanciada, para o app
 * consumir só isto — mantendo `infra-nao-vaza` satisfeito.
 *
 * `usage` agora é a implementação REAL vinda do editorial (fecha o D5 da Fase 2):
 * "editoria/tag em uso por matéria publicada não se exclui" deixou de ser stub.
 */
const prisma = createPrismaClient();

const ids = new UuidGenerator();
const usage = contentUsage;

export const sectionDeps = {
	repo: new PrismaSectionRepository(prisma),
	usage,
	ids,
};

export const tagDeps = {
	repo: new PrismaTagRepository(prisma),
	usage,
	ids,
};
