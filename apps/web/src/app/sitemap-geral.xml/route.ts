import { siteConfig } from "@/config/site";
import { getAuthors, getSections, getTags } from "@/data/queries";
import { type UrlEntry, urlset } from "@/lib/feed";
import { routes } from "@/lib/routes";
import { xmlResponse } from "@/lib/xml";

/**
 * Sitemap das páginas de navegação: home, últimas, editorias, autores e tags.
 * As matérias em si ficam nos sitemaps por editoria (ver o índice).
 */
export const dynamic = "force-dynamic";

const abs = (path: string) => `${siteConfig.url}${path}`;

export async function GET() {
	const [sections, authors, tags] = await Promise.all([
		getSections(),
		getAuthors(),
		getTags(),
	]);

	const entries: UrlEntry[] = [
		{ loc: abs(routes.home), changefreq: "hourly", priority: "1.0" },
		{ loc: abs(routes.latest), changefreq: "hourly", priority: "0.9" },
		...sections.map(
			(section): UrlEntry => ({
				loc: abs(routes.section(section.slug)),
				changefreq: "hourly",
				priority: "0.8",
			}),
		),
		...authors.map(
			(author): UrlEntry => ({
				loc: abs(routes.author(author.slug)),
				changefreq: "weekly",
			}),
		),
		...tags.map(
			(tag): UrlEntry => ({
				loc: abs(routes.tag(tag.slug)),
				changefreq: "weekly",
			}),
		),
	];

	return xmlResponse(urlset(entries));
}
