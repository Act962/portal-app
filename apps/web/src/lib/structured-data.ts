import { siteConfig } from "@/config/site";
import type { Article, Author } from "@/data/types";

import { toDateTimeAttribute } from "./format";

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
		datePublished: toDateTimeAttribute(article.publishedAt),
		dateModified: toDateTimeAttribute(article.updatedAt ?? article.publishedAt),
		articleSection: sectionName,
		keywords: article.tags.join(", "),
		inLanguage: siteConfig.locale,
		isAccessibleForFree: true,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		author: { "@type": "Person", name: author.name, jobTitle: author.role },
		publisher,
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
