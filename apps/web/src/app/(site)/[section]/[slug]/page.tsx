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
import { ViewTracker } from "@/components/news/view-tracker";
import { JsonLd } from "@/components/seo/json-ld";
import { NewsletterCard } from "@/components/sidebar/newsletter-card";
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
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import {
	notFoundMetadata,
	type OgImage,
	pageMetadata,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site-identity";
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
		// Devolver `{}` aqui deixava a página de 404 com o título da HOME na aba
		// e no histórico (spec 07, A8).
		return notFoundMetadata();
	}

	const [site, sectionName, author] = await Promise.all([
		loadSiteIdentity(),
		getSectionName(article.sectionSlug),
		getAuthor(article.authorSlug),
	]);

	/*
	 * Imagem social: a capa (já absoluta), servida pelo host do S3/R2. As
	 * dimensões vão junto quando a biblioteca as conhece — sem elas o WhatsApp
	 * precisa baixar o arquivo para decidir se mostra a prévia, e às vezes
	 * desiste no meio. Sem capa, cai para o cartão gerado da marca (D4).
	 */
	const images: OgImage[] | undefined = article.cover
		? [
				{
					url: article.cover.url,
					alt: article.cover.alt,
					...(article.cover.width && article.cover.height
						? { width: article.cover.width, height: article.cover.height }
						: {}),
				},
			]
		: undefined;

	return pageMetadata({
		site,
		title: article.title,
		description: article.standfirst,
		path: routes.article(article.sectionSlug, article.slug),
		eyebrow: article.kicker || sectionName,
		images,
		keywords: [...article.tags],
		authors: [
			{ name: author.name, url: absoluteUrl(site, routes.author(author.slug)) },
		],
		article: {
			publishedTime: toDateTimeAttribute(article.publishedAt),
			modifiedTime: toDateTimeAttribute(
				article.updatedAt ?? article.publishedAt,
			),
			section: sectionName,
			tags: [...article.tags],
			authorUrl: absoluteUrl(site, routes.author(author.slug)),
		},
	});
}

export default async function ArticlePage({ params }: ArticlePageProps) {
	const { section, slug } = await params;
	const article = await getArticle(section, slug);

	if (!article) {
		notFound();
	}

	const [author, sectionName, mostRead, related, site] = await Promise.all([
		getAuthor(article.authorSlug),
		getSectionName(article.sectionSlug),
		getMostRead(),
		getRelated(article),
		loadSiteIdentity(),
	]);
	const path = routes.article(article.sectionSlug, article.slug);
	const url = absoluteUrl(site, path);

	return (
		<>
			{/* `key`: uma leitura nova precisa de uma INSTÂNCIA nova, senão a
			    navegação entre matérias reaproveitaria o mesmo id de
			    visualização e a segunda leitura sobrescreveria a primeira. */}
			<ViewTracker key={article.slug} slug={article.slug} />
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
								/*
								 * `fetchPriority="high"` é o ganho real aqui (spec 07,
								 * A18): a capa é o elemento de LCP desta página, e o
								 * navegador só descobre isso depois de calcular o
								 * layout — dizer antes adianta o download, e LCP é um
								 * dos Core Web Vitals que entram no ranqueamento.
								 *
								 * `width`/`height` NÃO estão aqui pelo CLS: a classe já
								 * fixa a altura, então o espaço já era reservado. Estão
								 * porque são a informação correta sobre o arquivo, e é
								 * do mesmo campo que sai o `og:image:width` — quando a
								 * biblioteca de mídia mediu o arquivo.
								 */
								{...(article.cover.width && article.cover.height
									? {
											width: article.cover.width,
											height: article.cover.height,
										}
									: {})}
								fetchPriority="high"
								decoding="async"
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
				schema={newsArticleSchema({ site, article, author, sectionName, url })}
			/>
			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: sectionName, path: routes.section(article.sectionSlug) },
					{ name: article.title, path },
				])}
			/>
		</>
	);
}
