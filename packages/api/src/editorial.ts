import { createPrismaClient } from "@portal-app/db";
import { type ArticleRepository, SyncEventBus } from "@portal-app/editorial";
import { dispatchOutbox } from "@portal-app/editorial/infrastructure/outbox-relay";
import { PrismaArticleRepository } from "@portal-app/editorial/infrastructure/prisma-article-repository";
import type { Page, PageRequest } from "@portal-app/shared-kernel";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";
import type { ContentUsage } from "@portal-app/taxonomy";

/**
 * Eventos que viram registro de auditoria (A35).
 *
 * A lista não é só do editorial: o outbox e o relay são UM só para o sistema
 * inteiro, então quem quiser ser auditado se inscreve aqui. É o caso do
 * `SiteSettingsChanged` (spec 05b, D10), que chega pelo mesmo caminho.
 */
const AUDITED_EVENTS = [
	"ArticleSubmittedForReview",
	"ArticleRejected",
	"ArticleScheduled",
	"ArticlePublished",
	"ArticleUpdated",
	"ArticleUnpublished",
	"SiteSettingsChanged",
] as const;

/**
 * Raiz de composição do editorial. Também é AQUI que se fecha o D5 da Fase 2: a
 * porta `ContentUsage` da taxonomia (que estava com `StubNoUsage`) ganha a
 * implementação real, consultando o editorial. A cola vive na composição, então
 * `editorial` e `taxonomy` continuam sem se importar — a seta do context map
 * fica correta e `contextos-isolados` permanece verde.
 */
const prisma = createPrismaClient();

export const articleRepo: ArticleRepository = new PrismaArticleRepository(
	prisma,
);

/** Dependências dos casos de uso do editorial (relógio real em produção). */
export const articleDeps = {
	repo: articleRepo,
	clock: new SystemClock(),
	ids: new UuidGenerator(),
};

class EditorialContentUsage implements ContentUsage {
	constructor(private readonly articles: ArticleRepository) {}

	async sectionHasPublishedContent(sectionId: string): Promise<boolean> {
		return (await this.articles.countPublishedInSection(sectionId)) > 0;
	}

	async tagHasPublishedContent(tagId: string): Promise<boolean> {
		return (await this.articles.countPublishedWithTag(tagId)) > 0;
	}
}

/** Injetado no `sectionDeps`/`tagDeps` da taxonomia, no lugar do `StubNoUsage`. */
export const contentUsage: ContentUsage = new EditorialContentUsage(
	articleRepo,
);

/**
 * Barramento de eventos — adapter SÍNCRONO (o default; §5.1). O consumidor de
 * auditoria (A35/D7) grava um registro imutável a cada evento. Trocar por
 * node-cron/Inngest é trocar este bloco, sem tocar o núcleo.
 */
const eventBus = new SyncEventBus();
for (const eventName of AUDITED_EVENTS) {
	eventBus.on(eventName, async (record) => {
		await prisma.auditLog.create({
			data: {
				action: record.eventName,
				aggregateId: record.aggregateId,
				occurredAt: record.occurredAt,
				detail: record.payload as object,
			},
		});
	});
}

/**
 * Despacha o outbox pelo bus síncrono. Chamado após cada mutação editorial (e
 * pelo poller). Em produção, um node-cron/Inngest poderia dirigi-lo — o contrato
 * é o mesmo. Idempotente (não reentrega o já processado).
 */
export function dispatchEditorialEvents(): Promise<number> {
	return dispatchOutbox(prisma, eventBus);
}

/**
 * Volume de produção por autor e por editoria no período (A38/A39).
 *
 * Vive AQUI, na composição, e não no contexto de analytics: o dado é do
 * editorial (matérias publicadas), e fazer `analytics` importar `editorial`
 * quebraria `contextos-isolados`. É o mesmo arranjo do `ContentUsage` acima —
 * a cola mora na raiz de composição.
 *
 * Conta pela data de PUBLICAÇÃO, não de criação: o que interessa a um
 * relatório de produção é o que saiu no ar no período.
 */
export async function articleProductionBetween(
	from: Date,
	to: Date,
): Promise<{
	byAuthor: Array<{ name: string; articles: number }>;
	bySection: Array<{ name: string; articles: number }>;
}> {
	const where = {
		status: { in: ["PUBLICADA", "ATUALIZADA"] },
		publishedAt: { gte: from, lte: to },
	};

	const [authorRows, sectionRows, sections] = await Promise.all([
		prisma.article.groupBy({
			by: ["authorName"],
			where,
			_count: { _all: true },
		}),
		prisma.article.groupBy({
			by: ["sectionId"],
			where,
			_count: { _all: true },
		}),
		prisma.section.findMany({ select: { id: true, name: true } }),
	]);

	const sectionName = new Map(sections.map((s) => [s.id, s.name]));

	return {
		byAuthor: authorRows
			.map((row) => ({ name: row.authorName, articles: row._count._all }))
			.sort((a, b) => b.articles - a.articles),
		bySection: sectionRows
			.map((row) => ({
				// Matéria sem editoria não deveria existir publicada, mas se
				// existir é melhor aparecer rotulada do que sumir da soma.
				name: row.sectionId
					? (sectionName.get(row.sectionId) ?? "Editoria removida")
					: "Sem editoria",
				articles: row._count._all,
			}))
			.sort((a, b) => b.articles - a.articles),
	};
}

/**
 * Uma PÁGINA da auditoria (A35). DTO plano — o campo Json `detail` fica de fora
 * para não estourar a inferência de tipos do tRPC.
 *
 * Antes trazia `take: 100` fixo e sem total: passados 100 eventos, a tela
 * simplesmente parava de mostrar o resto, sem dizer que havia mais. Numa tabela
 * que só cresce e existe para prestar contas, truncar em silêncio é o pior
 * comportamento possível.
 *
 * O `headline` vem RESOLVIDO daqui. A tela antes cruzava `aggregateId` contra a
 * lista de matérias no cliente — o que só funcionava enquanto essa lista fosse
 * completa. Com a lista paginada, o título sumiria para tudo que estivesse fora
 * da primeira página.
 */
export async function listAuditLog(page: PageRequest): Promise<
	Page<{
		id: string;
		action: string;
		aggregateId: string;
		headline: string | null;
		occurredAt: Date;
		createdAt: Date;
	}>
> {
	const [rows, total] = await Promise.all([
		prisma.auditLog.findMany({
			orderBy: { createdAt: "desc" },
			take: page.limit,
			skip: page.offset,
		}),
		prisma.auditLog.count(),
	]);

	// Só os títulos DESTA página — uma consulta, não uma por linha.
	const articles = await prisma.article.findMany({
		where: { id: { in: [...new Set(rows.map((row) => row.aggregateId))] } },
		select: { id: true, headline: true },
	});
	const headlines = new Map(articles.map((a) => [a.id, a.headline]));

	return {
		items: rows.map((row) => ({
			id: row.id,
			action: row.action,
			aggregateId: row.aggregateId,
			// Nulo quando o evento não é de matéria, ou quando a matéria foi
			// apagada — a auditoria sobrevive ao que auditou, de propósito.
			headline: headlines.get(row.aggregateId) ?? null,
			occurredAt: row.occurredAt,
			createdAt: row.createdAt,
		})),
		total,
	};
}

/**
 * Quantas matérias em cada status — os cartões da visão geral.
 *
 * Existe porque a lista virou paginada: contar no cliente passaria a contar só
 * a página, e o painel mostraria "3 publicadas" com 300 no banco. Um `groupBy`,
 * não sete `count`.
 */
export async function countArticlesByStatus(): Promise<Record<string, number>> {
	const rows = await prisma.article.groupBy({
		by: ["status"],
		_count: { _all: true },
	});
	return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}
