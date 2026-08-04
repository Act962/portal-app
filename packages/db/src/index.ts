import type { PrismaClient } from "../prisma/generated/client";
import { newPrismaClient } from "./client";

/**
 * Prisma 7 removeu o query engine em Rust: o cliente agora exige um driver
 * adapter. A construção do cliente vive em `./client` (`newPrismaClient`), que
 * usa o `@prisma/adapter-pg`.
 *
 * In development Next.js re-evaluates modules on every hot reload, which would
 * open a new connection pool each time. Caching the client on `globalThis`
 * keeps exactly one pool per process.
 */
const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
	globalForPrisma.prisma ??= newPrismaClient();
	return globalForPrisma.prisma;
}

export { newPrismaClient };

export const prisma = createPrismaClient();

export default prisma;
