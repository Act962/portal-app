import type { PrismaClient } from "@portal-app/db/client";

import type { PageViewRecord } from "../domain/aggregation";
import type {
	PageViewLogPort,
	RecordedPageView,
} from "../domain/ports/page-view-log";
import type { TrafficSource } from "../domain/traffic-source";
import { TRAFFIC_SOURCES } from "../domain/traffic-source";

/**
 * Adapter Prisma da porta `PageViewLogPort`. Única camada que conhece Prisma.
 * Recebe o `PrismaClient` por injeção (não o singleton), o que o torna
 * testável contra o Postgres do Testcontainers no mesmo contrato que o fake.
 */
export class PrismaPageViewLog implements PageViewLogPort {
	constructor(private readonly prisma: PrismaClient) {}

	async record(view: RecordedPageView): Promise<void> {
		// `upsert` e não `create`: o beacon pode ser entregue duas vezes (retry
		// do browser), e a segunda entrega não pode explodir por chave duplicada
		// nem apagar um tempo de leitura já medido — por isso o update é vazio.
		await this.prisma.pageView.upsert({
			where: { id: view.id },
			create: {
				id: view.id,
				articleSlug: view.articleSlug,
				occurredAt: view.occurredAt,
				source: view.source,
			},
			update: {},
		});
	}

	async setReadingTime(viewId: string, seconds: number): Promise<void> {
		// `updateMany` em vez de `update`: se a linha não existe (o primeiro
		// beacon se perdeu), o certo é não fazer nada — não estourar.
		await this.prisma.pageView.updateMany({
			where: { id: viewId },
			data: { readingSeconds: seconds },
		});
	}

	async listBetween(from: Date, to: Date): Promise<PageViewRecord[]> {
		const rows = await this.prisma.pageView.findMany({
			where: { occurredAt: { gte: from, lte: to } },
			select: {
				articleSlug: true,
				occurredAt: true,
				readingSeconds: true,
				source: true,
			},
			orderBy: { occurredAt: "asc" },
		});
		return rows.map((row) => ({
			articleSlug: row.articleSlug,
			occurredAt: row.occurredAt,
			readingSeconds: row.readingSeconds,
			source: toSource(row.source),
		}));
	}
}

/** Origem desconhecida no banco cai em "outro" — dado velho não quebra a tela. */
function toSource(raw: string): TrafficSource {
	return (TRAFFIC_SOURCES as readonly string[]).includes(raw)
		? (raw as TrafficSource)
		: "outro";
}
