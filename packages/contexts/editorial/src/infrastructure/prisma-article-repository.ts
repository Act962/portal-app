import type { PrismaClient } from "@portal-app/db/client";

import { Article } from "../domain/article";
import type { Block } from "../domain/body";
import type { EditorialStatus } from "../domain/editorial-status";
import {
	type ArticleFilter,
	type ArticleRepository,
	PUBLISHED_STATUSES,
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

	async save(article: Article): Promise<void> {
		const data = toPersistence(article);
		await this.prisma.article.upsert({
			where: { id: article.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.article.delete({ where: { id } });
	}

	async list(filter?: ArticleFilter): Promise<Article[]> {
		const term = filter?.search?.trim();
		const rows = await this.prisma.article.findMany({
			where: {
				status: filter?.status,
				sectionId: filter?.sectionId,
				authorId: filter?.authorId,
				...(term ? { headline: { contains: term, mode: "insensitive" } } : {}),
			},
			orderBy: { createdAt: "desc" },
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
			where: { tagIds: { has: tagId }, status: { in: [...PUBLISHED_STATUSES] } },
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
		body: (row.body ?? []) as Block[],
		byline: { authorId: row.authorId, name: row.authorName },
		sectionId: row.sectionId,
		tagIds: row.tagIds,
		cover: row.coverMediaId ? { mediaId: row.coverMediaId, altText: row.coverAltText } : null,
		status: row.status as EditorialStatus,
		scheduledAt: row.scheduledAt,
		publishedAt: row.publishedAt,
		firstPublishedAt: row.firstPublishedAt,
		rejectionReason: row.rejectionReason,
	});
}
