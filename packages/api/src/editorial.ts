import { createPrismaClient } from "@portal-app/db";
import { type ArticleRepository, SyncEventBus } from "@portal-app/editorial";
import { dispatchOutbox } from "@portal-app/editorial/infrastructure/outbox-relay";
import { PrismaArticleRepository } from "@portal-app/editorial/infrastructure/prisma-article-repository";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";
import type { ContentUsage } from "@portal-app/taxonomy";

/** Eventos que viram registro de auditoria (A35). */
const AUDITED_EVENTS = [
	"ArticleSubmittedForReview",
	"ArticleRejected",
	"ArticleScheduled",
	"ArticlePublished",
	"ArticleUpdated",
	"ArticleUnpublished",
] as const;

/**
 * Raiz de composição do editorial. Também é AQUI que se fecha o D5 da Fase 2: a
 * porta `ContentUsage` da taxonomia (que estava com `StubNoUsage`) ganha a
 * implementação real, consultando o editorial. A cola vive na composição, então
 * `editorial` e `taxonomy` continuam sem se importar — a seta do context map
 * fica correta e `contextos-isolados` permanece verde.
 */
const prisma = createPrismaClient();

export const articleRepo: ArticleRepository = new PrismaArticleRepository(prisma);

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
export const contentUsage: ContentUsage = new EditorialContentUsage(articleRepo);

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

/** Registro de auditoria mais recente (A35). DTO plano — o campo Json `detail`
 * fica de fora para não estourar a inferência de tipos do tRPC. */
export async function listAuditLog(): Promise<
	Array<{ id: string; action: string; aggregateId: string; occurredAt: Date; createdAt: Date }>
> {
	const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
	return rows.map((row) => ({
		id: row.id,
		action: row.action,
		aggregateId: row.aggregateId,
		occurredAt: row.occurredAt,
		createdAt: row.createdAt,
	}));
}
