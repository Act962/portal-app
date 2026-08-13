import { getAllArticles, getAuthors } from "@/data/queries";
import { rssFeed } from "@/lib/feed";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { xmlResponse } from "@/lib/xml";

/** RSS geral (P28): as 50 matérias mais recentes de todo o portal. */
export const dynamic = "force-dynamic";

export async function GET() {
	const [site, all, authors] = await Promise.all([
		loadSiteIdentity(),
		getAllArticles(),
		getAuthors(),
	]);

	return xmlResponse(
		rssFeed({
			site,
			title: `${site.name} — Últimas notícias`,
			description: site.description,
			path: "/rss.xml",
			articles: all.slice(0, 50),
			authorNames: new Map(authors.map((a) => [a.slug, a.name])),
		}),
	);
}
