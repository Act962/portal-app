import { PrismaClient } from "../prisma/generated/client";

/**
 * In development Next.js re-evaluates modules on every hot reload, which would
 * open a new connection pool each time. Caching the client on `globalThis`
 * keeps exactly one pool per process.
 */
const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
	globalForPrisma.prisma ??= new PrismaClient();
	return globalForPrisma.prisma;
}

export const prisma = createPrismaClient();

export default prisma;
