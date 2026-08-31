import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdPlacement } from "@/components/ads/ad-placement";
import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { AuthorProfileCard } from "@/components/people/author-profile-card";
import { JsonLd } from "@/components/seo/json-ld";
import {
	getArticlesByAuthor,
	getAuthor,
	getAuthors,
	getMostRead,
} from "@/data/queries";
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
	personSchema,
} from "@/lib/structured-data";

type AuthorPageProps = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ page?: string }>;
};

export async function generateStaticParams() {
	return (await getAuthors()).map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({
	params,
	searchParams,
}: AuthorPageProps): Promise<Metadata> {
	const { slug } = await params;
	const { page } = await searchParams;
	const articles = await getArticlesByAuthor(slug);

	if (articles.length === 0) {
		return notFoundMetadata();
	}

	const [author, site] = await Promise.all([
		getAuthor(slug),
		loadSiteIdentity(),
	]);
	const currentPage = parsePageParam(page);
	const description =
		author.bio || `Matérias de ${author.name} na ${site.name}.`;

	return pageMetadata({
		site,
		title:
			currentPage > 1 ? `${author.name} — página ${currentPage}` : author.name,
		description,
		path: canonicalFor(routes.author(author.slug), currentPage),
		type: "profile",
		eyebrow: author.role || "Assinatura",
		/*
		 * A foto do autor como imagem social só quando ela existe. Sem foto, o
		 * cartão gerado (D4) leva o nome — o que é melhor do que a arte genérica
		 * do veículo, porque o link compartilhado costuma ser "olha a coluna do
		 * fulano", não "olha a rádio".
		 */
		...(author.photoUrl ? { images: [{ url: author.photoUrl }] } : {}),
	});
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

	const [author, mostRead, site] = await Promise.all([
		getAuthor(slug),
		getMostRead(),
		loadSiteIdentity(),
	]);
	const listing = paginate(articles, parsePageParam(page));
	const basePath = routes.author(author.slug);

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
				<AuthorProfileCard author={author} />

				<ArticleList
					articles={listing.items}
					currentPage={listing.currentPage}
					totalPages={listing.totalPages}
					basePath={basePath}
					emptyMessage={`${author.name} ainda não tem matérias publicadas.`}
				/>
			</ContentWithSidebar>

			<JsonLd schema={personSchema({ site, author })} />
			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: author.name, path: basePath },
				])}
			/>

			<JsonLd
				schema={collectionPageSchema({
					site,
					name: `Matérias de ${author.name}`,
					description:
						author.bio || `Tudo o que ${author.name} assinou na ${site.name}.`,
					path: canonicalFor(basePath, listing.currentPage),
					items: articleListItems(listing.items),
					offset: (listing.currentPage - 1) * DEFAULT_PAGE_SIZE,
				})}
			/>
		</>
	);
}
