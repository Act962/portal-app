import { siteConfig } from "@/config/site";
import type { Article } from "@/data/types";

import { routes } from "./routes";
import { escapeXml } from "./xml";

/**
 * Construtores dos feeds do portal. Centraliza a montagem do XML para que as
 * rotas (`/rss.xml`, `/{editoria}/rss.xml`, sitemaps) só reúnam os dados e
 * escolham o título.
 */

function articleUrl(article: Article): string {
	return `${siteConfig.url}${routes.article(article.sectionSlug, article.slug)}`;
}

function lastmod(article: Article): string {
	return new Date(article.updatedAt ?? article.publishedAt).toISOString();
}

// --- RSS 2.0 ---------------------------------------------------------------

function rssItem(article: Article): string {
	const url = articleUrl(article);
	return [
		"    <item>",
		`      <title>${escapeXml(article.title)}</title>`,
		`      <link>${url}</link>`,
		`      <guid isPermaLink="true">${url}</guid>`,
		`      <description>${escapeXml(article.standfirst)}</description>`,
		`      <category>${escapeXml(article.sectionSlug)}</category>`,
		`      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
		"    </item>",
	].join("\n");
}

export function rssFeed(options: {
	title: string;
	description: string;
	/** Caminho canônico deste feed, para o `atom:link rel="self"`. */
	path: string;
	articles: Article[];
}): string {
	const self = `${siteConfig.url}${options.path}`;
	return [
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		"  <channel>",
		`    <title>${escapeXml(options.title)}</title>`,
		`    <link>${siteConfig.url}</link>`,
		`    <description>${escapeXml(options.description)}</description>`,
		`    <language>${siteConfig.locale}</language>`,
		`    <atom:link href="${self}" rel="self" type="application/rss+xml" />`,
		...options.articles.map(rssItem),
		"  </channel>",
		"</rss>",
	].join("\n");
}

// --- Sitemaps --------------------------------------------------------------

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

export function sitemapIndex(paths: string[]): string {
	const entries = paths.map((path) =>
		[
			"  <sitemap>",
			`    <loc>${siteConfig.url}${path}</loc>`,
			"  </sitemap>",
		].join("\n"),
	);
	return [
		`<sitemapindex xmlns="${SITEMAP_NS}">`,
		...entries,
		"</sitemapindex>",
	].join("\n");
}

export type UrlEntry = {
	loc: string;
	lastmod?: string;
	changefreq?: "hourly" | "daily" | "weekly" | "monthly";
	priority?: string;
};

export function urlset(entries: UrlEntry[]): string {
	const urls = entries.map((entry) => {
		const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
		if (entry.lastmod) {
			lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
		}
		if (entry.changefreq) {
			lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
		}
		if (entry.priority) {
			lines.push(`    <priority>${entry.priority}</priority>`);
		}
		return ["  <url>", ...lines, "  </url>"].join("\n");
	});
	return [`<urlset xmlns="${SITEMAP_NS}">`, ...urls, "</urlset>"].join("\n");
}

/** Uma matéria como entrada de sitemap padrão (loc + lastmod). */
export function articleUrlEntry(article: Article): UrlEntry {
	return {
		loc: articleUrl(article),
		lastmod: lastmod(article),
		changefreq: "daily",
	};
}

// --- Google News sitemap ---------------------------------------------------

const NEWS_NS = "http://www.google.com/schemas/sitemap-news/0.9";

/**
 * News sitemap (P27): só as matérias das últimas 48 h e no máximo 1.000 URLs —
 * os dois limites que o Google impõe a este feed. `publication_date` em ISO 8601.
 */
export function newsSitemap(articles: Article[]): string {
	const cutoff = Date.now() - 48 * 60 * 60 * 1000;
	const fresh = articles
		.filter((article) => Date.parse(article.publishedAt) >= cutoff)
		.slice(0, 1000);

	const urls = fresh.map((article) =>
		[
			"  <url>",
			`    <loc>${escapeXml(articleUrl(article))}</loc>`,
			"    <news:news>",
			"      <news:publication>",
			`        <news:name>${escapeXml(siteConfig.name)}</news:name>`,
			`        <news:language>${siteConfig.locale.split("-")[0]}</news:language>`,
			"      </news:publication>",
			`      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>`,
			`      <news:title>${escapeXml(article.title)}</news:title>`,
			"    </news:news>",
			"  </url>",
		].join("\n"),
	);

	return [
		`<urlset xmlns="${SITEMAP_NS}" xmlns:news="${NEWS_NS}">`,
		...urls,
		"</urlset>",
	].join("\n");
}
