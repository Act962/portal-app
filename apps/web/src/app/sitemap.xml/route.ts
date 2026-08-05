import { getSections } from "@/data/queries";
import { sitemapIndex } from "@/lib/feed";
import { xmlResponse } from "@/lib/xml";

/**
 * Índice de sitemaps (`/sitemap.xml`): aponta o sitemap geral, um por editoria
 * (P26) e o news-sitemap. Dinâmico até a Etapa 5 ligar a revalidação por evento.
 */
export const dynamic = "force-dynamic";

export async function GET() {
	const sections = await getSections();
	const paths = [
		"/sitemap-geral.xml",
		...sections.map((section) => `/${section.slug}/sitemap.xml`),
		"/news-sitemap.xml",
	];
	return xmlResponse(sitemapIndex(paths));
}
