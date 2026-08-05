import { getArticlesBySection, getSection } from "@/data/queries";
import { articleUrlEntry, urlset } from "@/lib/feed";
import { xmlResponse } from "@/lib/xml";

/** Sitemap de uma editoria (P26): as matérias publicadas naquela editoria. */
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

	const articles = await getArticlesBySection(found.slug);
	return xmlResponse(urlset(articles.map(articleUrlEntry)));
}
