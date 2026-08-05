import { AdSlot } from "@portal-app/ui/components/ad-slot";
import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleBody } from "@/components/news/article-body";
import { ArticleHeader } from "@/components/news/article-header";
import { ArticleTags } from "@/components/news/article-tags";
import { Breadcrumbs } from "@/components/news/breadcrumbs";
import { MostReadList } from "@/components/news/most-read-list";
import { RelatedNews } from "@/components/news/related-news";
import { JsonLd } from "@/components/seo/json-ld";
import { NewsletterCard } from "@/components/sidebar/newsletter-card";
import { siteConfig } from "@/config/site";
import {
	getAllArticles,
	getArticle,
	getAuthor,
	getMostRead,
	getRelated,
	getSectionName,
} from "@/data/queries";
import { toDateTimeAttribute } from "@/lib/format";
import { routes } from "@/lib/routes";
import { breadcrumbSchema, newsArticleSchema } from "@/lib/structured-data";

type ArticlePageProps = {
	params: Promise<{ section: string; slug: string }>;
};

export async function generateStaticParams() {
	return (await getAllArticles()).map((article) => ({
		section: article.sectionSlug,
		slug: article.slug,
	}));
}

export async function generateMetadata({
	params,
}: ArticlePageProps): Promise<Metadata> {
	const { section, slug } = await params;
	const article = await getArticle(section, slug);

	if (!article) {
		return {};
	}

	const canonical = routes.article(article.sectionSlug, article.slug);
	// Imagem social: a capa (já absoluta), servida pelo host do S3/R2. Sem capa,
	// cai para a arte padrão da marca herdada do layout raiz.
	const images = article.cover
		? [{ url: article.cover.url, alt: article.cover.alt }]
		: undefined;

	return {
		title: article.title,
		description: article.standfirst,
		alternates: { canonical },
		openGraph: {
			type: "article",
			title: article.title,
			description: article.standfirst,
			url: canonical,
			publishedTime: toDateTimeAttribute(article.publishedAt),
			modifiedTime: toDateTimeAttribute(
				article.updatedAt ?? article.publishedAt,
			),
			section: await getSectionName(article.sectionSlug),
			tags: [...article.tags],
			...(images ? { images } : {}),
		},
		...(images ? { twitter: { card: "summary_large_image", images } } : {}),
	};
}

export default async function ArticlePage({ params }: ArticlePageProps) {
	const { section, slug } = await params;
	const article = await getArticle(section, slug);

	if (!article) {
		notFound();
	}

	const [author, sectionName, mostRead, related] = await Promise.all([
		getAuthor(article.authorSlug),
		getSectionName(article.sectionSlug),
		getMostRead(),
		getRelated(article),
	]);
	const path = routes.article(article.sectionSlug, article.slug);
	const url = `${siteConfig.url}${path}`;

	return (
		<>
			<ContentWithSidebar
				gap="article"
				// The article opens with a breadcrumb, not a full-bleed band, so it
				// needs the top spacing back on mobile.
				contentClassName="max-w-article pt-3.5 md:pt-0"
				sidebar={
					<>
						<AdSlot format="sidebar" />
						<MostReadList articles={mostRead} />
						<NewsletterCard />
					</>
				}
			>
				<Breadcrumbs
					crumbs={[
						{ label: sectionName, href: routes.section(article.sectionSlug) },
						{ label: "Matéria" },
					]}
				/>

				<article className="max-w-article">
					<ArticleHeader article={article} author={author} url={url} />

					<figure className="-mx-4 md:mx-0">
						{/* Edge-to-edge on a phone: the photo is the one element that
						    benefits from the full width of a small screen. O corte
						    respeita o ponto focal escolhido na redação (P15/A32). */}
						{article.cover ? (
							// biome-ignore lint/a11y/useAltText: alt aplicado via prop
							<img
								src={article.cover.url}
								alt={article.cover.alt}
								style={{
									objectPosition: `${article.cover.focalX * 100}% ${article.cover.focalY * 100}%`,
								}}
								className="block h-[220px] w-full object-cover md:h-[415px] md:rounded-card"
							/>
						) : (
							<MediaPlaceholder
								label="[ foto principal 16:9 ]"
								className="h-[220px] w-auto rounded-none md:h-[415px] md:w-full md:rounded-card"
							/>
						)}
						{article.coverCaption ? (
							<figcaption className="px-4 pt-1.5 font-mono text-[9.5px] text-meta leading-relaxed md:px-0 md:pt-2 md:text-[10px]">
								{article.coverCaption}
							</figcaption>
						) : null}
					</figure>

					<ArticleBody blocks={article.body} adAfterBlock={2} />

					<ArticleTags tags={article.tags} />
				</article>

				<RelatedNews articles={related} />
			</ContentWithSidebar>

			<JsonLd
				schema={newsArticleSchema({ article, author, sectionName, url })}
			/>
			<JsonLd
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: sectionName, path: routes.section(article.sectionSlug) },
					{ name: article.title, path },
				])}
			/>
		</>
	);
}
