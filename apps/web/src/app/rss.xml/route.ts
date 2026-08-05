import { siteConfig } from "@/config/site";
import { getAllArticles } from "@/data/queries";
import { rssFeed } from "@/lib/feed";
import { xmlResponse } from "@/lib/xml";

/** RSS geral (P28): as 50 matérias mais recentes de todo o portal. */
export const dynamic = "force-dynamic";

export async function GET() {
	const articles = (await getAllArticles()).slice(0, 50);
	return xmlResponse(
		rssFeed({
			title: `${siteConfig.name} — Últimas notícias`,
			description: siteConfig.description,
			path: "/rss.xml",
			articles,
		}),
	);
}
