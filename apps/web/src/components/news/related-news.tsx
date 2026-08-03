import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

import { NewsCard } from "./news-card";

/** Compact thumbnail row used only in the mobile "Leia também" list. */
function RelatedRow({ article }: { article: Article }) {
	return (
		<li className="border-hairline border-t">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="flex gap-3 py-3 text-brand-navy hover:text-brand-navy"
			>
				<MediaPlaceholder className="h-[62px] w-[88px] shrink-0" />
				<span className="flex-1 text-pretty font-bold text-[14.5px] leading-[1.24]">
					{article.title}
				</span>
			</Link>
		</li>
	);
}

export function RelatedNews({ articles }: { articles: Article[] }) {
	if (articles.length === 0) {
		return null;
	}

	return (
		<section className="mt-6 md:mt-section">
			<SectionHeader title="Leia também" className="mb-2.5 md:mb-4" />

			<ul className="md:hidden">
				{articles.map((article) => (
					<RelatedRow key={article.slug} article={article} />
				))}
			</ul>

			<div className="hidden gap-5 md:grid md:grid-cols-3">
				{articles.map((article) => (
					<NewsCard
						key={article.slug}
						article={article}
						size="sm"
						showTimestamp={false}
					/>
				))}
			</div>
		</section>
	);
}
