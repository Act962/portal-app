import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdPlacement } from "@/components/ads/ad-placement";
import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { FeatureStory } from "@/components/news/feature-story";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { SortChips } from "@/components/news/sort-chips";
import { JsonLd } from "@/components/seo/json-ld";
import {
	getArticlesBySection,
	getMostRead,
	getSection,
	getSections,
	sortArticles,
} from "@/data/queries";
import { DEFAULT_PAGE_SIZE, paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import {
	canonicalFor,
	notFoundMetadata,
	pageMetadata,
} from "@/lib/seo/metadata";
import { parseOrderParam } from "@/lib/sorting";
import {
	articleListItems,
	breadcrumbSchema,
	collectionPageSchema,
} from "@/lib/structured-data";

type SectionPageProps = {
	params: Promise<{ section: string }>;
	searchParams: Promise<{ page?: string; ordem?: string }>;
};

export async function generateStaticParams() {
	return (await getSections()).map((section) => ({ section: section.slug }));
}

export async function generateMetadata({
	params,
	searchParams,
}: SectionPageProps): Promise<Metadata> {
	const { section: slug } = await params;
	const { page } = await searchParams;
	const section = await getSection(slug);

	if (!section) {
		return notFoundMetadata();
	}

	const site = await loadSiteIdentity();
	const currentPage = parsePageParam(page);
	const description =
		section.description || `Notícias de ${section.name} na ${site.name}.`;

	return pageMetadata({
		site,
		// A página 2 leva o número no título: dois `<title>` idênticos para URLs
		// diferentes é o sinal mais direto de duplicata que existe.
		title:
			currentPage > 1
				? `${section.name} — página ${currentPage}`
				: section.name,
		description,
		// Autocanônica por página, e sem `?ordem=` (spec 07, D3).
		path: canonicalFor(routes.section(section.slug), currentPage),
		eyebrow: "Editoria",
		rss: {
			path: `/${section.slug}/rss.xml`,
			title: `${section.name} — RSS`,
		},
	});
}

export default async function SectionPage({
	params,
	searchParams,
}: SectionPageProps) {
	const { section: slug } = await params;
	const { page, ordem } = await searchParams;
	const section = await getSection(slug);

	if (!section) {
		notFound();
	}

	const order = parseOrderParam(ordem);
	const sorted = sortArticles(await getArticlesBySection(section.slug), order);
	const [feature, ...rest] = sorted;
	const listing = paginate(rest, parsePageParam(page));
	const basePath = routes.section(section.slug);
	const site = await loadSiteIdentity();

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdPlacement slot="sidebar" sectionId={section.id} />
						<MostReadList
							articles={await getMostRead()}
							title={`Mais lidas em ${section.name}`}
						/>
					</>
				}
			>
				<PageHeading
					eyebrow="Editoria"
					title={section.name}
					description={section.description}
					action={<SortChips basePath={basePath} current={order} />}
				/>

				{feature ? <FeatureStory article={feature} /> : null}

				<ArticleList
					articles={listing.items}
					currentPage={listing.currentPage}
					totalPages={listing.totalPages}
					basePath={basePath}
					emptyMessage="Ainda não há outras matérias nesta editoria."
				/>
			</ContentWithSidebar>

			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: section.name, path: basePath },
				])}
			/>

			<JsonLd
				schema={collectionPageSchema({
					site,
					name: section.name,
					description: section.description || `Notícias de ${section.name}.`,
					path: canonicalFor(basePath, listing.currentPage),
					// A matéria em destaque entra na lista: ela É a primeira da
					// editoria, e deixá-la de fora faria o `ItemList` descrever uma
					// página diferente da que o leitor vê.
					items: articleListItems(
						listing.currentPage === 1 && feature
							? [feature, ...listing.items]
							: listing.items,
					),
					offset:
						listing.currentPage === 1
							? 0
							: (listing.currentPage - 1) * DEFAULT_PAGE_SIZE + 1,
				})}
			/>
		</>
	);
}
