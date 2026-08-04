import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

export type { PrismaClient } from "../prisma/generated/client";

/**
 * Cria um cliente Prisma novo (não-singleton) com o adapter pg. Aponta para a
 * `DATABASE_URL` do ambiente por padrão, mas aceita outra connection string —
 * é o que os testes de integração usam para falar com o Postgres efêmero do
 * Testcontainers, e o que um script pontual usaria para outro banco.
 *
 * Mora fora de `index.ts` de propósito: importar este módulo não instancia o
 * singleton, então testes/scripts podem construir o cliente sem exigir uma
 * `DATABASE_URL` já no ambiente.
 */
export function newPrismaClient(
	connectionString = process.env.DATABASE_URL as string,
): PrismaClient {
	return new PrismaClient({
		adapter: new PrismaPg({ connectionString }),
	});
}
