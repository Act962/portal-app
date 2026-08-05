import { siteConfig } from "@/config/site";
import type { Article, Author } from "@/data/types";

import { toDateTimeAttribute } from "./format";
import { routes } from "./routes";

function absolute(path: string): string {
	return `${siteConfig.url}${path}`;
}

/**
 * schema.org payloads.
 *
 * `NewsArticle` is what gets a story considered for Google News and Discover,
 * so the fields Google treats as required (headline ≤110 chars, datePublished,
 * dateModified, publisher, author) are all populated here rather than left to
 * chance in a template.
 */

const publisher = {
	"@type": "NewsMediaOrganization",
	name: siteConfig.name,
	logo: {
		"@type": "ImageObject",
		url: `${siteConfig.url}${siteConfig.logo}`,
	},
};

export function organizationSchema() {
	return {
		"@context": "https://schema.org",
		...publisher,
		url: siteConfig.url,
		email: siteConfig.contact.email,
		telephone: siteConfig.contact.newsroom,
		areaServed: `${siteConfig.city} — ${siteConfig.state}`,
		sameAs: siteConfig.social.map((network) => network.href),
	};
}

export function newsArticleSchema({
	article,
	author,
	sectionName,
	url,
}: {
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
		...(article.cover ? { image: [article.cover.url] } : {}),
		datePublished: toDateTimeAttribute(article.publishedAt),
		dateModified: toDateTimeAttribute(article.updatedAt ?? article.publishedAt),
		articleSection: sectionName,
		keywords: article.tags.join(", "),
		inLanguage: siteConfig.locale,
		isAccessibleForFree: true,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		author: {
			"@type": "Person",
			name: author.name,
			jobTitle: author.role,
			// Vincula a assinatura à página de autor (E-E-A-T).
			url: absolute(routes.author(author.slug)),
		},
		publisher,
	};
}

/**
 * `WebSite` com `SearchAction` — habilita a caixa de busca de sitelinks do Google
 * (a busca do portal direto na SERP). Emitido uma vez, na home.
 */
export function websiteSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: siteConfig.name,
		url: siteConfig.url,
		inLanguage: siteConfig.locale,
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${siteConfig.url}/busca?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

/**
 * `ProfilePage` da página de autor (E-E-A-T): quem assina, cargo, bio e perfis
 * externos (`sameAs`). É o par estruturado do `AuthorProfileCard`.
 */
export function personSchema({ author }: { author: Author }) {
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
			url: absolute(routes.author(author.slug)),
			...(author.bio ? { description: author.bio } : {}),
			...(author.photoUrl ? { image: author.photoUrl } : {}),
			...(sameAs.length > 0 ? { sameAs } : {}),
			worksFor: publisher,
		},
	};
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: `${siteConfig.url}${item.path}`,
		})),
	};
}
