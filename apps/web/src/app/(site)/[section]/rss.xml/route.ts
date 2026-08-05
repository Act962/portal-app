import { siteConfig } from "@/config/site";
import { getArticlesBySection, getSection } from "@/data/queries";
import { rssFeed } from "@/lib/feed";
import { xmlResponse } from "@/lib/xml";

/** RSS por editoria (P28): as 50 matérias mais recentes daquela editoria. */
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ section: string }> },
) {
	const { section } = await params;
	const found = await getSection(section);
	if (!found) {
		return new Response("Not found", { status: 404 });
	}

	const articles = (await getArticlesBySection(found.slug)).slice(0, 50);
	return xmlResponse(
		rssFeed({
			title: `${siteConfig.name} — ${found.name}`,
			description: found.description || `Notícias de ${found.name}.`,
			path: `/${found.slug}/rss.xml`,
			articles,
		}),
	);
}
