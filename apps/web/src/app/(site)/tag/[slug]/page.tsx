import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { getArticlesByTag, getMostRead, getTag, getTags } from "@/data/queries";
import { paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { breadcrumbSchema } from "@/lib/structured-data";

type TagPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
	return (await getTags()).map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
	params,
}: TagPageProps): Promise<Metadata> {
	const { slug } = await params;
	const tag = await getTag(slug);

	if (!tag) {
		return {};
	}

	const description = `Tudo sobre ${tag.name} na ${siteConfig.name}.`;

	return {
		title: `#${tag.name}`,
		description,
		alternates: { canonical: routes.tag(tag.slug) },
		openGraph: { title: `#${tag.name}`, description },
	};
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
	const { slug } = await params;
	const { page } = await searchParams;
	const tag = await getTag(slug);

	if (!tag) {
		notFound();
	}

	const [articles, mostRead] = await Promise.all([
		getArticlesByTag(tag.slug),
		getMostRead(),
	]);
	const listing = paginate(articles, parsePageParam(page));
	const basePath = routes.tag(tag.slug);

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdSlot format="sidebar" />
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
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: `#${tag.name}`, path: basePath },
				])}
			/>
		</>
	);
}
