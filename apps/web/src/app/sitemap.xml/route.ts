import { getAllArticles, getSections } from "@/data/queries";
import { latestModified, type SitemapRef, sitemapIndex } from "@/lib/feed";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { xmlResponse } from "@/lib/xml";

/**
 * Índice de sitemaps (`/sitemap.xml`): aponta o sitemap geral, um por editoria
 * (P26) e o news-sitemap. Dinâmico até a Etapa 5 ligar a revalidação por evento.
 */
export const dynamic = "force-dynamic";

export async function GET() {
	const [site, sections, articles] = await Promise.all([
		loadSiteIdentity(),
		getSections(),
		getAllArticles(),
	]);

	/*
	 * `lastmod` por sitemap (spec 07, A10). Custa um agrupamento em memória sobre
	 * uma lista que já foi carregada, e é o que permite ao rastreador pular a
	 * editoria parada em vez de revisitar as N no escuro toda vez.
	 */
	const bySection = new Map<string, typeof articles>();
	for (const article of articles) {
		const list = bySection.get(article.sectionSlug) ?? [];
		list.push(article);
		bySection.set(article.sectionSlug, list);
	}

	const refs: SitemapRef[] = [
		{ path: "/sitemap-geral.xml", lastmod: latestModified(articles) },
		...sections.map(
			(section): SitemapRef => ({
				path: `/${section.slug}/sitemap.xml`,
				lastmod: latestModified(bySection.get(section.slug) ?? []),
			}),
		),
		{ path: "/news-sitemap.xml", lastmod: latestModified(articles) },
	];

	return xmlResponse(sitemapIndex(site, refs));
}
