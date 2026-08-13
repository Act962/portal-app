import type { Article } from "@/data/types";

import { routes } from "./routes";
import { absoluteUrl, type SiteIdentity } from "./seo/site-identity";
import { escapeXml } from "./xml";

/**
 * Construtores dos feeds do portal. Centraliza a montagem do XML para que as
 * rotas (`/rss.xml`, `/{editoria}/rss.xml`, sitemaps) só reúnam os dados e
 * escolham o título.
 *
 * A identidade do veículo entra por PARÂMETRO (spec 07, D1): antes vinha de
 * `config/site.ts` enquanto as tags do `<head>` já vinham do banco, e trocar o
 * domínio nas Configurações produzia sitemap e canônica discordando.
 */

function articleUrl(site: SiteIdentity, article: Article): string {
	return absoluteUrl(site, routes.article(article.sectionSlug, article.slug));
}

function lastmod(article: Article): string {
	return new Date(article.updatedAt ?? article.publishedAt).toISOString();
}

/** A data de modificação mais recente de um conjunto — `undefined` se vazio. */
export function latestModified(articles: Article[]): string | undefined {
	if (articles.length === 0) {
		return undefined;
	}
	return articles
		.map(lastmod)
		.reduce((newest, current) => (current > newest ? current : newest));
}

// --- RSS 2.0 ---------------------------------------------------------------

const ATOM_NS = "http://www.w3.org/2005/Atom";
const DC_NS = "http://purl.org/dc/elements/1.1/";

function rssItem(
	site: SiteIdentity,
	article: Article,
	authorName?: string,
): string {
	const url = articleUrl(site, article);
	const lines = [
		"    <item>",
		`      <title>${escapeXml(article.title)}</title>`,
		`      <link>${url}</link>`,
		`      <guid isPermaLink="true">${url}</guid>`,
		`      <description>${escapeXml(article.standfirst)}</description>`,
		`      <category>${escapeXml(article.sectionSlug)}</category>`,
		`      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
	];

	// A assinatura. `dc:creator` e não `<author>`: o elemento do RSS 2.0 exige
	// e-MAIL, e publicar o endereço de cada repórter num feed aberto é convite
	// para spam — o Dublin Core aceita o nome, que é o que o leitor precisa ver.
	if (authorName) {
		lines.push(`      <dc:creator>${escapeXml(authorName)}</dc:creator>`);
	}

	// A capa como `enclosure` (spec 07, A12): é o que faz o agregador e o
	// leitor de feed mostrarem a matéria COM foto em vez de um bloco de texto.
	if (article.cover) {
		lines.push(
			`      <enclosure url="${escapeXml(article.cover.url)}" type="${mimeFor(article.cover.url)}" length="0" />`,
		);
	}

	lines.push("    </item>");
	return lines.join("\n");
}

/**
 * O `type` do `enclosure` é obrigatório no RSS 2.0 e não temos o content-type
 * guardado — inferir pela extensão é o que dá para fazer com honestidade. JPEG
 * é o palpite padrão porque é o que sai da câmera da redação.
 */
function mimeFor(url: string): string {
	const extension = url.split("?")[0]?.split(".").pop()?.toLowerCase();
	switch (extension) {
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		case "gif":
			return "image/gif";
		case "avif":
			return "image/avif";
		default:
			return "image/jpeg";
	}
}

export function rssFeed(options: {
	site: SiteIdentity;
	title: string;
	description: string;
	/** Caminho canônico deste feed, para o `atom:link rel="self"`. */
	path: string;
	articles: Article[];
	/** Nome do autor por slug, para o `dc:creator` de cada item. */
	authorNames?: Map<string, string>;
}): string {
	const { site } = options;
	const self = absoluteUrl(site, options.path);
	const newest = latestModified(options.articles);

	return [
		`<rss version="2.0" xmlns:atom="${ATOM_NS}" xmlns:dc="${DC_NS}">`,
		"  <channel>",
		`    <title>${escapeXml(options.title)}</title>`,
		`    <link>${site.url}</link>`,
		`    <description>${escapeXml(options.description)}</description>`,
		`    <language>${site.locale}</language>`,
		`    <copyright>${escapeXml(site.name)}</copyright>`,
		// `lastBuildDate` e `ttl` dizem ao agregador quando voltar. Sem eles cada
		// leitor escolhe sozinho — uns batendo de minuto em minuto, outros uma vez
		// por dia, e a matéria de agora só aparecendo amanhã.
		...(newest
			? [`    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>`]
			: []),
		"    <ttl>15</ttl>",
		"    <image>",
		`      <url>${escapeXml(site.logoUrl)}</url>`,
		`      <title>${escapeXml(options.title)}</title>`,
		`      <link>${site.url}</link>`,
		"    </image>",
		`    <atom:link href="${self}" rel="self" type="application/rss+xml" />`,
		...options.articles.map((article) =>
			rssItem(site, article, options.authorNames?.get(article.authorSlug)),
		),
		"  </channel>",
		"</rss>",
	].join("\n");
}

// --- Sitemaps --------------------------------------------------------------

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";

export type SitemapRef = { path: string; lastmod?: string };

export function sitemapIndex(site: SiteIdentity, refs: SitemapRef[]): string {
	const entries = refs.map((ref) =>
		[
			"  <sitemap>",
			`    <loc>${absoluteUrl(site, ref.path)}</loc>`,
			// `lastmod` no índice (spec 07, A10) é o que permite ao rastreador
			// PULAR o sitemap de uma editoria parada em vez de rebaixá-lo inteiro.
			...(ref.lastmod ? [`    <lastmod>${ref.lastmod}</lastmod>`] : []),
			"  </sitemap>",
		].join("\n"),
	);
	return [
		`<sitemapindex xmlns="${SITEMAP_NS}">`,
		...entries,
		"</sitemapindex>",
	].join("\n");
}

export type UrlEntry = {
	loc: string;
	lastmod?: string;
	// Os valores do protocolo de sitemaps. `yearly` entrou com as páginas de
	// Privacidade e Termos — documentos que mudam de ano em ano, e para os quais
	// `monthly` seria uma promessa falsa ao rastreador.
	changefreq?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
	priority?: string;
	/** Imagens desta URL, para a extensão de imagem do sitemap. */
	images?: { loc: string; caption?: string }[];
};

export function urlset(entries: UrlEntry[]): string {
	const hasImages = entries.some((entry) => (entry.images?.length ?? 0) > 0);
	const urls = entries.map((entry) => {
		const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
		if (entry.lastmod) {
			lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
		}
		if (entry.changefreq) {
			lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
		}
		if (entry.priority) {
			lines.push(`    <priority>${entry.priority}</priority>`);
		}
		for (const image of entry.images ?? []) {
			lines.push(
				"    <image:image>",
				`      <image:loc>${escapeXml(image.loc)}</image:loc>`,
				...(image.caption
					? [`      <image:caption>${escapeXml(image.caption)}</image:caption>`]
					: []),
				"    </image:image>",
			);
		}
		return ["  <url>", ...lines, "  </url>"].join("\n");
	});
	// O namespace de imagem só é declarado quando há imagem: um `xmlns` sobrando
	// é válido, mas faz o diff do sitemap mentir sobre o que mudou.
	const open = hasImages
		? `<urlset xmlns="${SITEMAP_NS}" xmlns:image="${IMAGE_NS}">`
		: `<urlset xmlns="${SITEMAP_NS}">`;
	return [open, ...urls, "</urlset>"].join("\n");
}

/** Uma matéria como entrada de sitemap padrão (loc + lastmod + capa). */
export function articleUrlEntry(
	site: SiteIdentity,
	article: Article,
): UrlEntry {
	return {
		loc: articleUrl(site, article),
		lastmod: lastmod(article),
		changefreq: "daily",
		// A capa no sitemap (spec 07, A11) é o caminho de entrada no Google
		// Imagens — que num portal local vale busca por nome de rua e de evento.
		...(article.cover
			? {
					images: [
						{
							loc: article.cover.url,
							caption: article.cover.alt || article.title,
						},
					],
				}
			: {}),
	};
}

// --- Google News sitemap ---------------------------------------------------

const NEWS_NS = "http://www.google.com/schemas/sitemap-news/0.9";

/**
 * News sitemap (P27): só as matérias das últimas 48 h e no máximo 1.000 URLs —
 * os dois limites que o Google impõe a este feed. `publication_date` em ISO 8601.
 *
 * Sem `news:keywords` nem `news:genres` de propósito: os dois foram
 * DESCONTINUADOS pelo Google (spec 07, D5), e emiti-los seria XML morto.
 */
export function newsSitemap(
	site: SiteIdentity,
	articles: Article[],
	now: Date,
): string {
	const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
	const fresh = articles
		.filter((article) => Date.parse(article.publishedAt) >= cutoff)
		.slice(0, 1000);

	const urls = fresh.map((article) =>
		[
			"  <url>",
			`    <loc>${escapeXml(articleUrl(site, article))}</loc>`,
			"    <news:news>",
			"      <news:publication>",
			`        <news:name>${escapeXml(site.name)}</news:name>`,
			`        <news:language>${site.language}</news:language>`,
			"      </news:publication>",
			`      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>`,
			`      <news:title>${escapeXml(article.title)}</news:title>`,
			"    </news:news>",
			"  </url>",
		].join("\n"),
	);

	return [
		`<urlset xmlns="${SITEMAP_NS}" xmlns:news="${NEWS_NS}">`,
		...urls,
		"</urlset>",
	].join("\n");
}
