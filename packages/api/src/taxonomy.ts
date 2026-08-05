import { createPrismaClient } from "@portal-app/db";
import { UuidGenerator } from "@portal-app/shared-kernel";
import { type ContentUsage, StubNoUsage } from "@portal-app/taxonomy";
import { PrismaSectionRepository } from "@portal-app/taxonomy/infrastructure/prisma-section-repository";
import { PrismaTagRepository } from "@portal-app/taxonomy/infrastructure/prisma-tag-repository";

/**
 * Raiz de composição da taxonomia no lado servidor. Como em `staff.ts`, é AQUI
 * (camada de API) que a infraestrutura do contexto é instanciada, para o app
 * consumir só isto — mantendo `infra-nao-vaza` satisfeito.
 *
 * `usage` é o `StubNoUsage`: nesta fase nada está "em uso" (não há matérias).
 * Na Fase 3 o Editorial fornece a implementação real por trás da mesma porta.
 */
const prisma = createPrismaClient();

const ids = new UuidGenerator();
const usage: ContentUsage = new StubNoUsage();

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
