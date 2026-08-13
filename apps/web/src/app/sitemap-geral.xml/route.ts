import {
	getAllArticles,
	getAuthors,
	getSections,
	getTags,
} from "@/data/queries";
import { latestModified, type UrlEntry, urlset } from "@/lib/feed";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { absoluteUrl } from "@/lib/seo/site-identity";
import { xmlResponse } from "@/lib/xml";

/**
 * Sitemap das páginas de navegação: home, últimas, editorias, autores e tags.
 * As matérias em si ficam nos sitemaps por editoria (ver o índice).
 */
export const dynamic = "force-dynamic";

export async function GET() {
	const [site, sections, authors, tags, articles] = await Promise.all([
		loadSiteIdentity(),
		getSections(),
		getAuthors(),
		getTags(),
		getAllArticles(),
	]);

	const abs = (path: string) => absoluteUrl(site, path);

	/*
	 * `lastmod` das listagens (spec 07, A10) — a home e a página de últimas
	 * mudam junto com a matéria mais recente, e é essa data que diz ao
	 * rastreador que vale a pena voltar. Cada editoria/autor/tag usa a data do
	 * conteúdo dela, e não a de hoje: `lastmod` mentiroso é ignorado pelo
	 * Google depois de algumas visitas, e leva o sitemap inteiro junto.
	 */
	const newest = latestModified(articles);
	const modifiedFor = (
		predicate: (article: (typeof articles)[number]) => boolean,
	) => latestModified(articles.filter(predicate));

	const entries: UrlEntry[] = [
		{
			loc: abs(routes.home),
			lastmod: newest,
			changefreq: "hourly",
			priority: "1.0",
		},
		{
			loc: abs(routes.latest),
			lastmod: newest,
			changefreq: "hourly",
			priority: "0.9",
		},
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
				lastmod: modifiedFor((a) => a.sectionSlug === section.slug),
				changefreq: "hourly",
				priority: "0.8",
			}),
		),
		...authors.map(
			(author): UrlEntry => ({
				loc: abs(routes.author(author.slug)),
				lastmod: modifiedFor((a) => a.authorSlug === author.slug),
				changefreq: "weekly",
			}),
		),
		...tags.map(
			(tag): UrlEntry => ({
				loc: abs(routes.tag(tag.slug)),
				lastmod: modifiedFor((a) => a.tags.includes(tag.slug)),
				changefreq: "weekly",
			}),
		),
	];

	return xmlResponse(urlset(entries));
}
