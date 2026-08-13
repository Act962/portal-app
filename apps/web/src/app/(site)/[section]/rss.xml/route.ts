import { getArticlesBySection, getAuthors, getSection } from "@/data/queries";
import { rssFeed } from "@/lib/feed";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
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

	const [site, articles, authors] = await Promise.all([
		loadSiteIdentity(),
		getArticlesBySection(found.slug),
		getAuthors(),
	]);

	return xmlResponse(
		rssFeed({
			site,
			title: `${site.name} — ${found.name}`,
			description: found.description || `Notícias de ${found.name}.`,
			path: `/${found.slug}/rss.xml`,
			articles: articles.slice(0, 50),
			authorNames: new Map(authors.map((a) => [a.slug, a.name])),
		}),
	);
}
