import { getAllArticles } from "@/data/queries";
import { newsSitemap } from "@/lib/feed";
import { xmlResponse } from "@/lib/xml";

/**
 * `/news-sitemap.xml` (P27): o feed que o Google News lê. `newsSitemap` já corta
 * para as últimas 48 h e ≤1.000 URLs, os limites do formato.
 */
export const dynamic = "force-dynamic";

export async function GET() {
	return xmlResponse(newsSitemap(await getAllArticles()));
}
