import type { ArticleOrder } from "@/lib/sorting";

import type { Article } from "./types";

export type { HomeBlock, ProgramRow } from "./read-model";
/**
 * A camada de leitura do portal. Os componentes importam SÓ daqui.
 *
 * Na Fase 4 (D1) o corpo migrou das fixtures para o read model real
 * (`read-model.ts`, backed pelo Postgres) — os fetchers agora são `async`. As
 * únicas funções que permanecem síncronas são as PURAS (não tocam dados):
 * `displayTimestamp` e `sortArticles` operam sobre um `Article` já em mãos.
 */
export {
	getAllArticles,
	getArticle,
	getArticlesByAuthor,
	getArticlesBySection,
	getArticlesByTag,
	getAuthor,
	getAuthors,
	getColumnists,
	getColumnistsWithLatest,
	getHeadline,
	getHomeBlocks,
	getLatest,
	getMostRead,
	getRelated,
	getSecondaryStories,
	getSection,
	getSectionName,
	getSections,
	getTag,
	getTags,
	getTicker,
	loadSchedule,
	loadSiteSettings,
	searchArticles,
} from "./read-model";

/**
 * The moment a listing should show. A story edited after publication is
 * "há 12 min" to the reader, not "há 2 horas" — the byline on the article
 * page still carries the original publication time.
 */
export function displayTimestamp(article: Article): string {
	return article.updatedAt ?? article.publishedAt;
}

/** Ordering for listings. "lidas" puts ranked stories first, then the rest. */
export function sortArticles(
	articles: Article[],
	order: ArticleOrder,
): Article[] {
	if (order === "lidas") {
		return [...articles].sort(
			(a, b) =>
				(a.mostReadRank ?? Number.POSITIVE_INFINITY) -
				(b.mostReadRank ?? Number.POSITIVE_INFINITY),
		);
	}
	return [...articles].sort(
		(a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
	);
}
