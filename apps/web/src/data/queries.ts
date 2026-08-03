import type { ArticleOrder } from "@/lib/sorting";

import { ARTICLES } from "./articles";
import { AUTHORS } from "./authors";
import { HOME_BLOCK_SECTIONS, SECTIONS } from "./sections";
import type { Article, Author, Section } from "./types";

/**
 * The read API the portal renders against.
 *
 * Every component imports from here and never from the fixture files, so
 * Phase 4 replaces these bodies with real queries against the Editorial
 * context without touching a single component.
 */

function required<T>(value: T | undefined, what: string): T {
	if (value === undefined) {
		throw new Error(`Fixture ausente: ${what}`);
	}
	return value;
}

function newestFirst(a: Article, b: Article): number {
	return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}

const byDate = [...ARTICLES].sort(newestFirst);

/**
 * The moment a listing should show. A story edited after publication is
 * "há 12 min" to the reader, not "há 2 horas" — the byline on the article
 * page still carries the original publication time.
 */
export function displayTimestamp(article: Article): string {
	return article.updatedAt ?? article.publishedAt;
}

export function getSections(): Section[] {
	return SECTIONS;
}

export function getSection(slug: string): Section | undefined {
	return SECTIONS.find((section) => section.slug === slug);
}

export function getSectionName(slug: string): string {
	return getSection(slug)?.name ?? slug;
}

export function getAuthor(slug: string): Author {
	return required(
		AUTHORS.find((author) => author.slug === slug),
		`autor "${slug}"`,
	);
}

export function getHeadline(): Article {
	return required(
		byDate.find((article) => article.isHeadline),
		"manchete principal",
	);
}

/** Stories flanking the headline at the top of the home page. */
export function getSecondaryStories(limit = 3): Article[] {
	return byDate.filter((article) => !article.isHeadline).slice(0, limit);
}

/** The "Últimas notícias" grid, skipping whatever the top of the page shows. */
export function getLatest(limit = 6): Article[] {
	const alreadyShown = new Set([
		getHeadline().slug,
		...getSecondaryStories().map((article) => article.slug),
	]);

	return byDate
		.filter((article) => !alreadyShown.has(article.slug))
		.slice(0, limit);
}

export function getTicker(limit = 4): Article[] {
	return byDate.filter((article) => !article.isHeadline).slice(0, limit);
}

export function getMostRead(): Article[] {
	return ARTICLES.filter((article) => article.mostReadRank !== undefined).sort(
		(a, b) => (a.mostReadRank ?? 0) - (b.mostReadRank ?? 0),
	);
}

export function getArticlesBySection(sectionSlug: string): Article[] {
	return byDate.filter((article) => article.sectionSlug === sectionSlug);
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

	return [...articles].sort(newestFirst);
}

export function getArticle(
	sectionSlug: string,
	slug: string,
): Article | undefined {
	return ARTICLES.find(
		(article) => article.sectionSlug === sectionSlug && article.slug === slug,
	);
}

export function getRelated(article: Article, limit = 3): Article[] {
	const sameSection = byDate.filter(
		(candidate) =>
			candidate.slug !== article.slug &&
			candidate.sectionSlug === article.sectionSlug,
	);

	const sharesTag = byDate.filter(
		(candidate) =>
			candidate.slug !== article.slug &&
			candidate.sectionSlug !== article.sectionSlug &&
			candidate.tags.some((tag) => article.tags.includes(tag)),
	);

	return [...sameSection, ...sharesTag].slice(0, limit);
}

export type HomeBlock = {
	section: Section;
	lead: Article;
	items: Article[];
};

/** Per-section blocks on the home page: one lead plus a short headline list. */
export function getHomeBlocks(): HomeBlock[] {
	return HOME_BLOCK_SECTIONS.flatMap((slug) => {
		const section = getSection(slug);
		const articles = getArticlesBySection(slug);
		const [lead, ...rest] = articles;

		if (!section || !lead) {
			return [];
		}

		return [{ section, lead, items: rest.slice(0, 3) }];
	});
}

export function searchArticles(query: string): Article[] {
	const terms = query.trim().toLowerCase();

	if (terms.length === 0) {
		return [];
	}

	return byDate.filter((article) =>
		[article.title, article.standfirst, article.kicker, ...article.tags]
			.join(" ")
			.toLowerCase()
			.includes(terms),
	);
}

/** Every published article, newest first — used to build static params. */
export function getAllArticles(): Article[] {
	return byDate;
}
