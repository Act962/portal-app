import { Kicker } from "@portal-app/ui/components/kicker";
import Link from "next/link";
import { displayTimestamp } from "@/data/queries";
import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";
import { ArticleThumb } from "./article-thumb";

import { Timestamp } from "./timestamp";

/**
 * Horizontal card: image left, text right. Used by section listings, search
 * results and the mobile home page — anywhere scanning many stories matters
 * more than imagery. The thumbnail is 104×74 on mobile, 220×140 from `md`.
 */
export function NewsRow({
	article,
	showStandfirst = true,
	showKicker = true,
}: {
	article: Article;
	showStandfirst?: boolean;
	showKicker?: boolean;
}) {
	return (
		<article className="border-hairline border-b">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="group flex gap-3 py-3 text-brand-ink hover:text-brand-ink md:gap-5 md:py-4.5"
			>
				<ArticleThumb
					article={article}
					className="h-[74px] w-[104px] shrink-0 md:h-[140px] md:w-[220px] md:max-w-[40%]"
				/>

				<div className="min-w-0 flex-1">
					{showKicker ? (
						<Kicker variant="text" className="mb-1 md:mb-1.5">
							{article.kicker}
						</Kicker>
					) : null}

					<h3 className="text-pretty font-bold text-[15px] leading-tight tracking-[-0.01em] group-hover:text-brand-accent-ink md:mb-2 md:text-[22px] md:tracking-[-0.02em]">
						{article.title}
					</h3>

					{showStandfirst ? (
						<p className="mb-2 hidden max-w-[70ch] font-serif text-[15px] text-ink-muted leading-normal md:block">
							{article.standfirst}
						</p>
					) : null}

					<Timestamp
						iso={displayTimestamp(article)}
						className="mt-1.5 block text-[9.5px] md:mt-0 md:text-[10px]"
					/>
				</div>
			</Link>
		</article>
	);
}
