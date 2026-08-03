import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

type MostReadListProps = {
	articles: Article[];
	title?: string;
	/** Window the ranking covers, e.g. "24H". */
	period?: string;
};

/** Navy ranking panel. The numeral is the visual anchor, so it stays oversized. */
export function MostReadList({
	articles,
	title = "Mais lidas",
	period,
}: MostReadListProps) {
	return (
		// Full-bleed band on mobile, rounded panel in the desktop rail.
		<section className="-mx-4 bg-brand-navy px-4 py-5 md:mx-0 md:rounded-card md:p-4.5">
			<SectionHeader
				title={title}
				tone="dark"
				className="mb-3.5 text-sm"
				action={
					period ? (
						<span className="font-mono text-[9px] text-on-navy-muted tracking-[0.1em]">
							{period}
						</span>
					) : undefined
				}
			/>

			<ol className="flex flex-col gap-3.5">
				{articles.map((article, index) => (
					<li key={article.slug}>
						<Link
							href={routes.article(article.sectionSlug, article.slug)}
							className="flex items-baseline gap-3 text-white hover:text-white"
						>
							<span
								aria-hidden
								className="w-[22px] shrink-0 font-extrabold text-[22px] text-brand-red italic leading-none md:w-5 md:text-xl"
							>
								{index + 1}
							</span>
							<span className="text-pretty font-semibold text-sm leading-snug hover:text-brand-red-soft">
								{article.title}
							</span>
						</Link>
					</li>
				))}
			</ol>
		</section>
	);
}
