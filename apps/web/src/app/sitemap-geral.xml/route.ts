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
		{ loc: abs(routes.columnists), changefreq: "weekly", priority: "0.6" },
		{ loc: abs(routes.polls), changefreq: "weekly", priority: "0.5" },
		// Privacidade e Termos entram com prioridade baixa e `yearly`: precisam
		// ser INDEXÁVEIS — o Google trata a existência deles como sinal de
		// confiabilidade do veículo — mas não competem por atenção com a
		// cobertura, e mudam de ano em ano.
		{ loc: abs(routes.privacy), changefreq: "yearly", priority: "0.2" },
		{ loc: abs(routes.terms), changefreq: "yearly", priority: "0.2" },
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
