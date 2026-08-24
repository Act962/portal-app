import type { PageRequest } from "@portal-app/shared-kernel";

import type { Article } from "../article";
import type { EditorialStatus } from "../editorial-status";

/** Filtro da lista editorial (A10): status, editoria, autor e busca por título. */
export type ArticleFilter = {
	status?: EditorialStatus;
	sectionId?: string;
	authorId?: string;
	search?: string;
};

/** Estados que contam como "publicado" para a checagem de uso (ContentUsage). */
export const PUBLISHED_STATUSES: readonly EditorialStatus[] = [
	"PUBLICADA",
	"ATUALIZADA",
];

/**
 * Porta de persistência do agregado `Article`. `save` é upsert por id. As
 * contagens `countPublished*` existem para a raiz de composição implementar a
 * porta `ContentUsage` da taxonomia (D5) — sem que editorial e taxonomy se
 * importem.
 */
export interface ArticleRepository {
	findById(id: string): Promise<Article | null>;
	findBySlug(slug: string): Promise<Article | null>;
	save(article: Article): Promise<void>;
	delete(id: string): Promise<void>;
	/**
	 * Lista com filtro e, opcionalmente, uma FATIA. Sem `page`, devolve tudo —
	 * é o que o poller e o calendário editorial precisam. Com `page`, o corte
	 * acontece no BANCO: paginar depois de trazer tudo para a memória é a
	 * paginação que não resolve nada.
	 */
	list(filter?: ArticleFilter, page?: PageRequest): Promise<Article[]>;
	/** Quantas matérias satisfazem o filtro, ignorando a fatia. */
	count(filter?: ArticleFilter): Promise<number>;
	/** Agendadas cujo horário já chegou (`scheduledAt <= now`) — para o poller. */
	listDueScheduled(now: Date): Promise<Article[]>;
	countPublishedInSection(sectionId: string): Promise<number>;
	countPublishedWithTag(tagId: string): Promise<number>;
}

/** Fake in-memory da porta — roda no mesmo contrato que o adapter Prisma. */
export class InMemoryArticleRepository implements ArticleRepository {
	private readonly store = new Map<string, Article>();
	private seq = 0;
	private readonly order = new Map<string, number>();

	findById(id: string): Promise<Article | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findBySlug(slug: string): Promise<Article | null> {
		for (const article of this.store.values()) {
			if (article.slug === slug) {
				return Promise.resolve(article);
			}
		}
		return Promise.resolve(null);
	}

	save(article: Article): Promise<void> {
		if (!this.order.has(article.id)) {
			this.seq += 1;
			this.order.set(article.id, this.seq);
		}
		this.store.set(article.id, article);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		this.order.delete(id);
		return Promise.resolve();
	}

	list(filter?: ArticleFilter, page?: PageRequest): Promise<Article[]> {
		const result = this.matching(filter);
		if (!page) {
			return Promise.resolve(result);
		}
		return Promise.resolve(result.slice(page.offset, page.offset + page.limit));
	}

	count(filter?: ArticleFilter): Promise<number> {
		return Promise.resolve(this.matching(filter).length);
	}

	/** O filtro e a ordem, sem a fatia — para `list` e `count` não divergirem. */
	private matching(filter?: ArticleFilter): Article[] {
		const term = filter?.search?.trim().toLowerCase();
		return [...this.store.values()]
			.filter((a) => (filter?.status ? a.status === filter.status : true))
			.filter((a) =>
				filter?.sectionId ? a.sectionId === filter.sectionId : true,
			)
			.filter((a) =>
				filter?.authorId ? a.byline.authorId === filter.authorId : true,
			)
			.filter((a) => (term ? a.headline.toLowerCase().includes(term) : true))
			.sort(
				(a, b) => (this.order.get(b.id) ?? 0) - (this.order.get(a.id) ?? 0),
			);
	}

	listDueScheduled(now: Date): Promise<Article[]> {
		const due = [...this.store.values()].filter((a) => {
			const at = a.scheduledAt;
			return (
				a.status === "AGENDADA" && at !== null && at.getTime() <= now.getTime()
			);
		});
		return Promise.resolve(due);
	}

	countPublishedInSection(sectionId: string): Promise<number> {
		return Promise.resolve(
			[...this.store.values()].filter(
				(a) => a.isPublished() && a.sectionId === sectionId,
			).length,
		);
	}

	countPublishedWithTag(tagId: string): Promise<number> {
		return Promise.resolve(
			[...this.store.values()].filter(
				(a) => a.isPublished() && a.tagIds.includes(tagId),
			).length,
		);
	}

	clear(): void {
		this.store.clear();
		this.order.clear();
		this.seq = 0;
	}
}
