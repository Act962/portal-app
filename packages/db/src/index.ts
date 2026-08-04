import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

/**
 * Prisma 7 removeu o query engine em Rust: o cliente agora exige um driver
 * adapter. Para PostgreSQL é o `@prisma/adapter-pg`, que gerencia o pool via
 * `pg` a partir da connection string.
 *
 * In development Next.js re-evaluates modules on every hot reload, which would
 * open a new connection pool each time. Caching the client on `globalThis`
 * keeps exactly one pool per process.
 */
const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
	globalForPrisma.prisma ??= new PrismaClient({
		adapter: new PrismaPg({
			connectionString: process.env.DATABASE_URL as string,
		}),
	});
	return globalForPrisma.prisma;
}

export const prisma = createPrismaClient();

export default prisma;
