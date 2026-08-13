import type { Article, Author } from "@/data/types";

import { toDateTimeAttribute } from "./format";
import { routes } from "./routes";
import { absoluteUrl, type SiteIdentity } from "./seo/site-identity";

/**
 * Payloads schema.org do portal.
 *
 * `NewsArticle` é o que põe uma matéria em consideração para o Google News e o
 * Discover, então os campos que o Google trata como obrigatórios (manchete
 * ≤110 caracteres, `datePublished`, `dateModified`, `publisher`, `author`) são
 * preenchidos aqui, e não deixados ao acaso de um template.
 *
 * Todas as funções recebem a identidade do veículo por PARÂMETRO (spec 07, D1).
 * Antes liam `config/site.ts`, o arquivo — o que fazia o portal se declarar num
 * domínio no `og:url` (que já vinha do banco) e noutro no schema.org assim que o
 * cliente trocasse a URL nas Configurações. Receber também as torna puras: dá
 * para testar o payload inteiro sem Postgres.
 */

/** `@id` estável do site, para os nós se referenciarem entre si. */
function websiteId(site: SiteIdentity): string {
	return `${site.url}/#website`;
}

function organizationId(site: SiteIdentity): string {
	return `${site.url}/#organization`;
}

/** O bloco `publisher`, referenciado por toda matéria. */
function publisherOf(site: SiteIdentity) {
	return {
		"@type": "NewsMediaOrganization",
		"@id": organizationId(site),
		name: site.name,
		logo: {
			"@type": "ImageObject",
			url: site.logoUrl,
		},
	};
}

export function organizationSchema(site: SiteIdentity) {
	return {
		"@context": "https://schema.org",
		...publisherOf(site),
		alternateName: site.shortName,
		description: site.description,
		url: site.url,
		...(site.email ? { email: site.email } : {}),
		...(site.phone ? { telephone: site.phone } : {}),
		areaServed: `${site.city} — ${site.state}`,
		/*
		 * Endereço e ponto de contato (spec 07, A15). Os dados já estavam nas
		 * Configurações e não chegavam a lugar nenhum do HTML — são justamente o
		 * que alimenta o painel de conhecimento de um veículo LOCAL, que é a
		 * consulta em que este portal pode ganhar do g1.
		 */
		address: {
			"@type": "PostalAddress",
			...(site.address ? { streetAddress: site.address } : {}),
			addressLocality: site.city,
			addressRegion: site.state,
			addressCountry: "BR",
		},
		...(site.phone || site.email
			? {
					contactPoint: {
						"@type": "ContactPoint",
						contactType: "newsroom",
						...(site.phone ? { telephone: site.phone } : {}),
						...(site.email ? { email: site.email } : {}),
						availableLanguage: site.locale,
					},
				}
			: {}),
		...(site.sameAs.length > 0 ? { sameAs: site.sameAs } : {}),
	};
}

/**
 * `WebSite` com `SearchAction` — habilita a caixa de busca de sitelinks do
 * Google (a busca do portal direto na SERP). Emitido uma vez, na home.
 */
export function websiteSchema(site: SiteIdentity) {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": websiteId(site),
		name: site.name,
		alternateName: site.shortName,
		url: site.url,
		inLanguage: site.locale,
		publisher: { "@id": organizationId(site) },
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${site.url}/busca?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

/** A capa como `ImageObject` — o Google pede dimensões, não uma URL solta. */
function coverImage(article: Article) {
	if (!article.cover) {
		return undefined;
	}
	return [
		{
			"@type": "ImageObject",
			url: article.cover.url,
			...(article.cover.width ? { width: article.cover.width } : {}),
			...(article.cover.height ? { height: article.cover.height } : {}),
			...(article.cover.alt ? { caption: article.cover.alt } : {}),
		},
	];
}

export function newsArticleSchema({
	site,
	article,
	author,
	sectionName,
	url,
}: {
	site: SiteIdentity;
	article: Article;
	author: Author;
	sectionName: string;
	url: string;
}) {
	return {
		"@context": "https://schema.org",
		"@type": "NewsArticle",
		headline: article.title.slice(0, 110),
		description: article.standfirst,
		// Google Discover favorece imagem grande (≥1200px). A capa já é absoluta.
		...(article.cover ? { image: coverImage(article) } : {}),
		datePublished: toDateTimeAttribute(article.publishedAt),
		dateModified: toDateTimeAttribute(article.updatedAt ?? article.publishedAt),
		articleSection: sectionName,
		keywords: article.tags.join(", "),
		inLanguage: site.locale,
		isAccessibleForFree: true,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		isPartOf: { "@id": websiteId(site) },
		/*
		 * `speakable` marca o trecho que um assistente de voz deve ler em voz alta
		 * (spec 07, D5). Aponta para os atributos `data-speakable` do
		 * `ArticleHeader` — seletor de dado, não de classe do Tailwind, que muda
		 * a cada ajuste de layout e levaria a marcação junto sem ninguém notar.
		 */
		speakable: {
			"@type": "SpeakableSpecification",
			cssSelector: [
				'[data-speakable="headline"]',
				'[data-speakable="summary"]',
			],
		},
		author: {
			"@type": "Person",
			name: author.name,
			jobTitle: author.role,
			// Vincula a assinatura à página de autor (E-E-A-T).
			url: absoluteUrl(site, routes.author(author.slug)),
		},
		publisher: publisherOf(site),
	};
}

/**
 * `ProfilePage` da página de autor (E-E-A-T): quem assina, cargo, bio e perfis
 * externos (`sameAs`). É o par estruturado do `AuthorProfileCard`.
 */
export function personSchema({
	site,
	author,
}: {
	site: SiteIdentity;
	author: Author;
}) {
	const sameAs = Object.values(author.socials ?? {}).filter(
		(href): href is string => Boolean(href),
	);
	return {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		mainEntity: {
			"@type": "Person",
			name: author.name,
			jobTitle: author.role,
			url: absoluteUrl(site, routes.author(author.slug)),
			...(author.bio ? { description: author.bio } : {}),
			...(author.photoUrl ? { image: author.photoUrl } : {}),
			...(sameAs.length > 0 ? { sameAs } : {}),
			worksFor: { "@id": organizationId(site) },
		},
	};
}

export function breadcrumbSchema(
	site: SiteIdentity,
	items: { name: string; path: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: absoluteUrl(site, item.path),
		})),
	};
}

/**
 * `CollectionPage` + `ItemList` das listagens (spec 07, A14).
 *
 * Editoria, tag, autor, últimas e colunistas eram, para o buscador, páginas de
 * texto solto: nada dizia que aquilo é uma LISTA, nem em que ordem. Com o
 * `ItemList` o Google sabe quais matérias a página reúne e pode usá-las como
 * caminho de rastreio — que é o que faz a matéria antiga continuar acessível
 * depois de sair da home.
 *
 * A posição é a da PÁGINA atual, deslocada pelo offset da paginação: item 1 da
 * página 2 é a posição 21, não a 1.
 */
export function collectionPageSchema({
	site,
	name,
	description,
	path,
	items,
	offset = 0,
}: {
	site: SiteIdentity;
	name: string;
	description: string;
	path: string;
	items: { name: string; path: string }[];
	offset?: number;
}) {
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name,
		description,
		url: absoluteUrl(site, path),
		inLanguage: site.locale,
		isPartOf: { "@id": websiteId(site) },
		mainEntity: {
			"@type": "ItemList",
			numberOfItems: items.length,
			itemListOrder: "https://schema.org/ItemListOrderDescending",
			itemListElement: items.map((item, index) => ({
				"@type": "ListItem",
				position: offset + index + 1,
				name: item.name,
				url: absoluteUrl(site, item.path),
			})),
		},
	};
}

/** Atalho: as matérias de uma listagem no formato que o `ItemList` espera. */
export function articleListItems(
	articles: Article[],
): { name: string; path: string }[] {
	return articles.map((article) => ({
		name: article.title,
		path: routes.article(article.sectionSlug, article.slug),
	}));
}
