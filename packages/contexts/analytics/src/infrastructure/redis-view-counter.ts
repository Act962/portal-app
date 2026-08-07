import type { Redis } from "ioredis";

import type { ViewCounterPort } from "../domain/ports/view-counter";

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Folga sobre a janela de 24h — limpa a chave sozinha mesmo sem leitura. */
const KEY_TTL_MS = 25 * 60 * 60 * 1000;
const TRACKED_SLUGS_KEY = "analytics:tracked-slugs";

function viewsKey(slug: string): string {
	return `analytics:views:${slug}`;
}

/**
 * Adapter Redis da porta `ViewCounterPort`. Cada matéria tem um sorted set
 * próprio (`views:{slug}`) com um membro por visualização, pontuado pelo
 * instante em que aconteceu — é o que permite contar "últimas 24h" de
 * verdade (janela móvel), não um balde que zera à meia-noite.
 *
 * `topSlugs` não sabe de antemão quais slugs existem, então mantém um SET à
 * parte (`tracked-slugs`) com todo slug que já recebeu visualização; a
 * varredura usa pipeline para não virar uma chamada de rede por matéria.
 */
export class RedisViewCounter implements ViewCounterPort {
	constructor(private readonly redis: Redis) {}

	async recordView(articleSlug: string, now: Date): Promise<void> {
		const member = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
		const key = viewsKey(articleSlug);
		const pipeline = this.redis.pipeline();
		pipeline.zadd(key, now.getTime(), member);
		pipeline.pexpire(key, KEY_TTL_MS);
		pipeline.sadd(TRACKED_SLUGS_KEY, articleSlug);
		await pipeline.exec();
	}

	async topSlugs(limit: number, now: Date): Promise<string[]> {
		const slugs = await this.redis.smembers(TRACKED_SLUGS_KEY);
		if (slugs.length === 0) {
			return [];
		}

		const windowStart = now.getTime() - WINDOW_MS;
		const pipeline = this.redis.pipeline();
		for (const slug of slugs) {
			const key = viewsKey(slug);
			// Poda o que já saiu da janela antes de contar — mantém a chave
			// pequena e o TTL de segurança relevante.
			pipeline.zremrangebyscore(key, "-inf", windowStart - 1);
			pipeline.zcount(key, windowStart, now.getTime());
		}
		const results = await pipeline.exec();

		const counts: Array<[string, number]> = [];
		const untracked: string[] = [];
		slugs.forEach((slug, index) => {
			// Cada slug ocupa 2 respostas no pipeline (zremrangebyscore, zcount).
			const countReply = results?.[index * 2 + 1];
			const count = Number(countReply?.[1] ?? 0);
			if (count > 0) {
				counts.push([slug, count]);
			} else {
				untracked.push(slug);
			}
		});

		if (untracked.length > 0) {
			// Sem visualização na janela: o slug sai do SET de rastreados, senão
			// ele cresce sem limite conforme matérias antigas saem de circulação.
			await this.redis.srem(TRACKED_SLUGS_KEY, ...untracked);
		}

		return counts
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([slug]) => slug);
	}
}
