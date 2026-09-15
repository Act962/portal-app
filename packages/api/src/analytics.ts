import type { ViewCounterPort } from "@portal-app/analytics";
import { createRedisClient } from "@portal-app/analytics/infrastructure/create-redis-client";
import { PrismaPageViewLog } from "@portal-app/analytics/infrastructure/prisma-page-view-log";
import { RedisViewCounter } from "@portal-app/analytics/infrastructure/redis-view-counter";
import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";

/**
 * Raiz de composição do analytics. Como em `taxonomy.ts`/`staff.ts`/
 * `broadcast.ts`, é AQUI que a infraestrutura entra — o resto do app só
 * conhece as portas.
 *
 * Dois armazenamentos, de propósito: o Redis (`viewCounter`) responde o "mais
 * lidas" do portal em tempo de render e esquece o que passou de 24h; o
 * Postgres (`pageViewLog`) guarda o histórico que o painel de insights lê por
 * período.
 */
const prisma = createPrismaClient();

// Static prerendering runs during `next build`, where Redis must never be
// contacted. In runtime, an absent URL intentionally degrades the optional
// ranking to recency instead of assuming a localhost Redis exists.
const redisUrl =
	process.env.NEXT_PHASE === "phase-production-build"
		? undefined
		: env.REDIS_URL;

const disabledViewCounter: ViewCounterPort = {
	recordView: async () => {},
	topSlugs: async () => [],
};

export const viewCounter: ViewCounterPort = redisUrl
	? new RedisViewCounter(createRedisClient(redisUrl))
	: disabledViewCounter;

export const pageViewLog = new PrismaPageViewLog(prisma);
