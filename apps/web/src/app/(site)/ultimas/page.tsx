import type { Metadata } from "next";

import { AdPlacement } from "@/components/ads/ad-placement";
import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { getAllArticles, getMostRead } from "@/data/queries";
import { DEFAULT_PAGE_SIZE, paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { canonicalFor, pageMetadata } from "@/lib/seo/metadata";
import {
	articleListItems,
	breadcrumbSchema,
	collectionPageSchema,
} from "@/lib/structured-data";

type LatestPageProps = {
	searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
	searchParams,
}: LatestPageProps): Promise<Metadata> {
	const { page } = await searchParams;
	const site = await loadSiteIdentity();
	const currentPage = parsePageParam(page);

	return pageMetadata({
		site,
		title:
			currentPage > 1
				? `Últimas notícias — página ${currentPage}`
				: "Últimas notícias",
		description: `Tudo o que foi publicado no portal da ${site.name}, da mais recente para a mais antiga.`,
		// Autocanônica por página (D3): é aqui que estão as matérias que já
		// saíram da home, e apontar a página 2 para a 1 as deixaria sem caminho.
		path: canonicalFor(routes.latest, currentPage),
		eyebrow: "Cobertura",
		rss: { path: "/rss.xml", title: `${site.name} — Últimas notícias` },
	});
}

export default async function LatestPage({ searchParams }: LatestPageProps) {
	const { page } = await searchParams;
	const [all, mostRead, site] = await Promise.all([
		getAllArticles(),
		getMostRead(),
		loadSiteIdentity(),
	]);
	const listing = paginate(all, parsePageParam(page));

	return (
		<>
			<ContentWithSidebar
				sidebar={
					<>
						<AdPlacement slot="sidebar" />
						<MostReadList articles={mostRead} period="24H" />
					</>
				}
			>
				<PageHeading eyebrow="Cobertura" title="Últimas notícias" />

				<ArticleList
					articles={listing.items}
					currentPage={listing.currentPage}
					totalPages={listing.totalPages}
					basePath={routes.latest}
				/>
			</ContentWithSidebar>

			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: "Últimas notícias", path: routes.latest },
				])}
			/>
			<JsonLd
				schema={collectionPageSchema({
					site,
					name: "Últimas notícias",
					description: `Tudo o que foi publicado no portal da ${site.name}.`,
					path: canonicalFor(routes.latest, listing.currentPage),
					items: articleListItems(listing.items),
					offset: (listing.currentPage - 1) * DEFAULT_PAGE_SIZE,
				})}
			/>
		</>
	);
}
