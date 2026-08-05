import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
import { paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { parseOrderParam } from "@/lib/sorting";
import { breadcrumbSchema } from "@/lib/structured-data";

type SectionPageProps = {
	params: Promise<{ section: string }>;
	searchParams: Promise<{ page?: string; ordem?: string }>;
};

export async function generateStaticParams() {
	return (await getSections()).map((section) => ({ section: section.slug }));
}

export async function generateMetadata({
	params,
}: SectionPageProps): Promise<Metadata> {
	const { section: slug } = await params;
	const section = await getSection(slug);

	if (!section) {
		return {};
	}

	return {
		title: section.name,
		description: section.description,
		alternates: {
			canonical: routes.section(section.slug),
			types: {
				"application/rss+xml": [
					{
						url: `/${section.slug}/rss.xml`,
						title: `${section.name} — RSS`,
					},
				],
			},
		},
		openGraph: { title: section.name, description: section.description },
	};
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

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdSlot format="sidebar" />
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
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: section.name, path: basePath },
				])}
			/>
		</>
	);
}
