import Link from "next/link";

import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

import { Timestamp } from "./timestamp";

/**
 * Densest listing form: time slot plus headline, no image.
 * Used under a section block's lead story.
 */
export function NewsHeadlineItem({ article }: { article: Article }) {
	return (
		<li className="border-hairline border-t">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="flex gap-3 py-2.5 text-brand-deep hover:text-brand-deep"
			>
				<Timestamp
					iso={article.publishedAt}
					variant="clock"
					className="w-13 shrink-0 pt-1"
				/>
				<span className="flex-1 text-pretty font-semibold text-[15px] leading-snug hover:text-brand-red">
					{article.title}
				</span>
			</Link>
		</li>
	);
}
