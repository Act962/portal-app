export const ARTICLE_ORDERS = {
	recentes: "Mais recentes",
	lidas: "Mais lidas",
} as const;

export type ArticleOrder = keyof typeof ARTICLE_ORDERS;

export const DEFAULT_ORDER: ArticleOrder = "recentes";

function isArticleOrder(value: string): value is ArticleOrder {
	return value in ARTICLE_ORDERS;
}

/** Reads `?ordem=` and falls back rather than throwing on a bad value. */
export function parseOrderParam(
	value: string | string[] | undefined,
): ArticleOrder {
	const raw = Array.isArray(value) ? value[0] : value;

	return raw && isArticleOrder(raw) ? raw : DEFAULT_ORDER;
}
