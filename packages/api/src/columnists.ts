import { createColumnist, slugForSignature } from "@portal-app/columnists";
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

/**
 * Garante que todo redator tenha um perfil editorial pronto para curadoria.
 * O perfil nasce oculto: um administrador adiciona foto, bio e só então decide
 * se ele aparece no portal. A operação é idempotente pelo slug da assinatura.
 */
export async function ensureHiddenColumnistForRedator(
	name: string,
): Promise<void> {
	const slug = slugForSignature(name);
	if (!slug || (await columnistDeps.repo.findBySlug(slug))) {
		return;
	}

	const created = await createColumnist({ name, active: false }, columnistDeps);

	// Uma criação concorrente pode ganhar a corrida entre o find e o save.
	// Nesse caso o objetivo já foi alcançado; demais falhas são propagadas.
	if (created.isErr() && created.error.name !== "SlugTaken") {
		throw created.error;
	}
}
