import { Kicker } from "@portal-app/ui/components/kicker";
import Link from "next/link";

import { displayTimestamp } from "@/data/queries";
import type { Article } from "@/data/types";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

import { ArticleThumb } from "./article-thumb";
import { Timestamp } from "./timestamp";

type HeroStoryProps = {
	article: Article;
	/** The home page's lead story is the page `h1`; elsewhere it is an `h2`. */
	headingLevel?: "h1" | "h2";
};

/**
 * The lead story.
 *
 * Mobile inverts it into a full-bleed dark block — on a phone the headline is
 * the entire first screen, so it gets to behave like a cover rather than the
 * first item of a page.
 */
export function HeroStory({ article, headingLevel = "h1" }: HeroStoryProps) {
	const Heading = headingLevel;

	return (
		<article className="-mx-4 bg-brand-deep md:mx-0 md:bg-transparent">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="group block text-white hover:text-white md:text-brand-deep md:hover:text-brand-deep"
			>
				<ArticleThumb
					article={article}
					tone="dark"
					className="h-[215px] w-full md:hidden"
					label="[ foto da manchete ]"
				/>
				<ArticleThumb
					article={article}
					label="[ foto da manchete 16:9 ]"
					className="hidden h-[320px] w-full md:mb-3.5 md:flex"
				/>

				<div className="px-4 pt-3.5 pb-4.5 md:p-0">
					<div className="mb-2.5 flex items-center gap-2 md:gap-2.5">
						<Kicker>
							<span className="md:hidden">DESTAQUE</span>
							<span className="hidden md:inline">{article.kicker}</span>
						</Kicker>

						<span className="font-mono text-[10px] text-on-brand-muted md:hidden">
							{article.kicker} · {formatRelativeTime(displayTimestamp(article))}
						</span>
						<Timestamp
							iso={displayTimestamp(article)}
							className="hidden text-[10.5px] md:block"
						/>
					</div>

					<Heading className="mb-2 text-pretty font-extrabold text-[25px] leading-[1.13] tracking-[-0.02em] md:mb-2.5 md:text-[40px] md:leading-[1.04] md:tracking-[-0.035em] md:group-hover:text-brand-red">
						{article.title}
					</Heading>

					<p className="max-w-[62ch] font-serif text-on-brand-soft text-sm leading-normal md:text-[17px] md:text-ink-muted">
						{article.standfirst}
					</p>
				</div>
			</Link>
		</article>
	);
}
