import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdPlacement } from "@/components/ads/ad-placement";
import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { getArticlesByTag, getMostRead, getTag, getTags } from "@/data/queries";
import { DEFAULT_PAGE_SIZE, paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import {
	canonicalFor,
	notFoundMetadata,
	pageMetadata,
} from "@/lib/seo/metadata";
import {
	articleListItems,
	breadcrumbSchema,
	collectionPageSchema,
} from "@/lib/structured-data";

type TagPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
	return (await getTags()).map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
	params,
	searchParams,
}: TagPageProps): Promise<Metadata> {
	const { slug } = await params;
	const { page } = await searchParams;
	const tag = await getTag(slug);

	if (!tag) {
		return notFoundMetadata();
	}

	const site = await loadSiteIdentity();
	const currentPage = parsePageParam(page);
	const description = `Tudo sobre ${tag.name} na ${site.name}.`;

	return pageMetadata({
		site,
		title:
			currentPage > 1 ? `#${tag.name} — página ${currentPage}` : `#${tag.name}`,
		description,
		path: canonicalFor(routes.tag(tag.slug), currentPage),
		eyebrow: "Assunto",
		keywords: [tag.name],
	});
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
	const { slug } = await params;
	const { page } = await searchParams;
	const tag = await getTag(slug);

	if (!tag) {
		notFound();
	}

	const [articles, mostRead, site] = await Promise.all([
		getArticlesByTag(tag.slug),
		getMostRead(),
		loadSiteIdentity(),
	]);
	const listing = paginate(articles, parsePageParam(page));
	const basePath = routes.tag(tag.slug);

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdPlacement slot="sidebar" />
						<MostReadList articles={mostRead} />
					</>
				}
			>
				<PageHeading
					eyebrow="Assunto"
					title={`#${tag.name}`}
					description={`Matérias marcadas com ${tag.name}.`}
				/>

				<ArticleList
					articles={listing.items}
					currentPage={listing.currentPage}
					totalPages={listing.totalPages}
					basePath={basePath}
					emptyMessage={`Ainda não há matérias sobre ${tag.name}.`}
				/>
			</ContentWithSidebar>

			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: `#${tag.name}`, path: basePath },
				])}
			/>

			<JsonLd
				schema={collectionPageSchema({
					site,
					name: `#${tag.name}`,
					description: `Matérias marcadas com ${tag.name}.`,
					path: canonicalFor(basePath, listing.currentPage),
					items: articleListItems(listing.items),
					offset: (listing.currentPage - 1) * DEFAULT_PAGE_SIZE,
				})}
			/>
		</>
	);
}
