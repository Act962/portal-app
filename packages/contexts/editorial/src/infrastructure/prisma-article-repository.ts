import type { PrismaClient } from "@portal-app/db/client";
import type { PageRequest } from "@portal-app/shared-kernel";

import { Article } from "../domain/article";
import { Body } from "../domain/body";
import type { EditorialStatus } from "../domain/editorial-status";
import {
	type ArticleFilter,
	type ArticleRepository,
	PUBLISHED_STATUSES,
	wantsArchived,
} from "../domain/ports/article-repository";

/**
 * Adapter Prisma da porta `ArticleRepository`. Única camada que conhece Prisma;
 * recebe o client por injeção, testável no contrato contra o Postgres do
 * Testcontainers.
 */
export class PrismaArticleRepository implements ArticleRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Article | null> {
		const row = await this.prisma.article.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findBySlug(slug: string): Promise<Article | null> {
		const row = await this.prisma.article.findUnique({ where: { slug } });
		return row ? toDomain(row) : null;
	}

	/**
	 * Persiste o agregado E seus eventos no OUTBOX, na MESMA transação (ADR 0005):
	 * ou tudo entra, ou nada entra — nunca "salvou o artigo mas perdeu o evento".
	 * O despacho fica para o relay, depois.
	 */
	async save(article: Article): Promise<void> {
		const events = article.pullEvents();
		const data = toPersistence(article);
		await this.prisma.$transaction(async (tx) => {
			await tx.article.upsert({
				where: { id: article.id },
				create: data,
				update: data,
			});
			if (events.length > 0) {
				await tx.outboxEvent.createMany({
					data: events.map((event) => ({
						aggregateId: article.id,
						eventName: event.eventName,
						// Serialização plana: Date vira ISO, métodos somem — pronto p/ Json.
						payload: JSON.parse(JSON.stringify(event)),
						occurredAt: event.occurredAt,
					})),
				});
			}
		});
	}

	/**
	 * Apaga a linha E grava os eventos pendentes no outbox, na MESMA transação —
	 * espelho exato do `save`. A ordem importa: o outbox primeiro, o `delete`
	 * depois, para que uma falha na remoção não deixe um `ArticleDeleted`
	 * anunciando o apagamento de uma matéria que continua lá.
	 */
	async delete(article: Article): Promise<void> {
		const events = article.pullEvents();
		await this.prisma.$transaction(async (tx) => {
			if (events.length > 0) {
				await tx.outboxEvent.createMany({
					data: events.map((event) => ({
						aggregateId: article.id,
						eventName: event.eventName,
						payload: JSON.parse(JSON.stringify(event)),
						occurredAt: event.occurredAt,
					})),
				});
			}
			await tx.article.delete({ where: { id: article.id } });
		});
	}

	async list(filter?: ArticleFilter, page?: PageRequest): Promise<Article[]> {
		const rows = await this.prisma.article.findMany({
			where: whereFrom(filter),
			orderBy: { createdAt: "desc" },
			// `take`/`skip` no BANCO. Trazer tudo e cortar em memória gastaria a
			// mesma consulta pesada que a paginação existe para evitar.
			...(page ? { take: page.limit, skip: page.offset } : {}),
		});
		return rows.map(toDomain);
	}

	count(filter?: ArticleFilter): Promise<number> {
		return this.prisma.article.count({ where: whereFrom(filter) });
	}

	async listDueScheduled(now: Date): Promise<Article[]> {
		const rows = await this.prisma.article.findMany({
			where: { status: "AGENDADA", scheduledAt: { lte: now } },
			orderBy: { scheduledAt: "asc" },
		});
		return rows.map(toDomain);
	}

	countPublishedInSection(sectionId: string): Promise<number> {
		return this.prisma.article.count({
			where: { sectionId, status: { in: [...PUBLISHED_STATUSES] } },
		});
	}

	countPublishedWithTag(tagId: string): Promise<number> {
		return this.prisma.article.count({
			where: {
				tagIds: { has: tagId },
				status: { in: [...PUBLISHED_STATUSES] },
			},
		});
	}
}

type ArticleRow = {
	id: string;
	headline: string;
	slug: string;
	kicker: string;
	standfirst: string;
	body: unknown;
	authorId: string;
	authorName: string;
	sectionId: string | null;
	tagIds: string[];
	coverMediaId: string | null;
	coverAltText: string | null;
	status: string;
	scheduledAt: Date | null;
	publishedAt: Date | null;
	firstPublishedAt: Date | null;
	rejectionReason: string | null;
};

function toPersistence(article: Article) {
	const cover = article.cover;
	return {
		id: article.id,
		headline: article.headline,
		slug: article.slug,
		kicker: article.kicker,
		standfirst: article.standfirst,
		body: [...article.body.blocks],
		authorId: article.byline.authorId,
		authorName: article.byline.name,
		sectionId: article.sectionId,
		tagIds: [...article.tagIds],
		coverMediaId: cover?.mediaId ?? null,
		coverAltText: cover?.altText ?? null,
		status: article.status,
		scheduledAt: article.scheduledAt,
		publishedAt: article.publishedAt,
		firstPublishedAt: article.firstPublishedAt,
		rejectionReason: article.rejectionReason,
	};
}

function toDomain(row: ArticleRow): Article {
	return Article.restore({
		id: row.id,
		headline: row.headline,
		slug: row.slug,
		kicker: row.kicker,
		standfirst: row.standfirst,
		// `fromRaw` em vez de um cast cego: cura o conteúdo gravado antes do
		// ADR 0010 (texto puro) na leitura, e nunca falha por bloco corrompido.
		body: [...Body.fromRaw(row.body).blocks],
		byline: { authorId: row.authorId, name: row.authorName },
		sectionId: row.sectionId,
		tagIds: row.tagIds,
		cover: row.coverMediaId
			? { mediaId: row.coverMediaId, altText: row.coverAltText }
			: null,
		status: row.status as EditorialStatus,
		scheduledAt: row.scheduledAt,
		publishedAt: row.publishedAt,
		firstPublishedAt: row.firstPublishedAt,
		rejectionReason: row.rejectionReason,
	});
}

/**
 * O `where` do filtro, em um lugar só. `list` e `count` PRECISAM concordar:
 * se divergirem, o total diz uma coisa e a lista mostra outra, e a última
 * página fica vazia sem explicação.
 */
function whereFrom(filter?: ArticleFilter) {
	const term = filter?.search?.trim();
	return {
		// Sem status pedido, o arquivo fica fora — a não ser que a lista peça.
		// `not` e não uma lista dos outros seis: status novo entra na lista
		// sozinho, sem ninguém lembrar de vir aqui adicioná-lo.
		...(filter?.status
			? { status: filter.status }
			: wantsArchived(filter)
				? {}
				: { status: { not: "ARQUIVADA" as const } }),
		sectionId: filter?.sectionId,
		authorId: filter?.authorId,
		...(term
			? { headline: { contains: term, mode: "insensitive" as const } }
			: {}),
	};
}
