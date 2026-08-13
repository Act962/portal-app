import { getAllArticles } from "@/data/queries";
import { newsSitemap } from "@/lib/feed";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { xmlResponse } from "@/lib/xml";

/**
 * `/news-sitemap.xml` (P27): o feed que o Google News lê. `newsSitemap` já corta
 * para as últimas 48 h e ≤1.000 URLs, os limites do formato.
 */
export const dynamic = "force-dynamic";

export async function GET() {
	const [site, articles] = await Promise.all([
		loadSiteIdentity(),
		getAllArticles(),
	]);
	// O relógio entra por parâmetro: é o que torna o corte de 48 h testável sem
	// congelar o relógio global (regra de testes do CLAUDE.md).
	return xmlResponse(newsSitemap(site, articles, new Date()));
}
