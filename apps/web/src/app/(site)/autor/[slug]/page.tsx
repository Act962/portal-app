import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { AuthorProfileCard } from "@/components/people/author-profile-card";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import {
	getArticlesByAuthor,
	getAuthor,
	getAuthors,
	getMostRead,
} from "@/data/queries";
import { paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";
import { breadcrumbSchema, personSchema } from "@/lib/structured-data";

type AuthorPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
	return (await getAuthors()).map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({
	params,
}: AuthorPageProps): Promise<Metadata> {
	const { slug } = await params;
	const articles = await getArticlesByAuthor(slug);

	if (articles.length === 0) {
		return {};
	}

	const author = await getAuthor(slug);
	const description =
		author.bio || `Matérias de ${author.name} na ${siteConfig.name}.`;

	return {
		title: author.name,
		description,
		alternates: { canonical: routes.author(author.slug) },
		openGraph: {
			type: "profile",
			title: author.name,
			description,
			url: routes.author(author.slug),
			...(author.photoUrl ? { images: [{ url: author.photoUrl }] } : {}),
		},
	};
}

export default async function AuthorPage({
	params,
	searchParams,
}: AuthorPageProps) {
	const { slug } = await params;
	const { page } = await searchParams;
	const articles = await getArticlesByAuthor(slug);

	if (articles.length === 0) {
		notFound();
	}

	const [author, mostRead] = await Promise.all([
		getAuthor(slug),
		getMostRead(),
	]);
	const listing = paginate(articles, parsePageParam(page));
	const basePath = routes.author(author.slug);

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
				<AuthorProfileCard author={author} />

				<ArticleList
					articles={listing.items}
					currentPage={listing.currentPage}
					totalPages={listing.totalPages}
					basePath={basePath}
					emptyMessage={`${author.name} ainda não tem matérias publicadas.`}
				/>
			</ContentWithSidebar>

			<JsonLd schema={personSchema({ author })} />
			<JsonLd
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: author.name, path: basePath },
				])}
			/>
		</>
	);
}
