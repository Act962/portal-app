import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import Link from "next/link";

import { displayTimestamp } from "@/data/queries";
import type { Article } from "@/data/types";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

/**
 * Opening story of a section page. Stacked and full-bleed on mobile; photo
 * left, text right from `md` up, where it has to out-weigh the list below it.
 */
export function FeatureStory({ article }: { article: Article }) {
	return (
		<article className="mb-1 border-hairline pb-4 md:border-b md:pb-stack">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="group block text-brand-navy hover:text-brand-navy md:grid md:grid-cols-[1.3fr_1fr] md:gap-stack"
			>
				<MediaPlaceholder
					label="[ foto de abertura ]"
					className="-mx-4 h-[190px] w-auto rounded-none md:mx-0 md:h-[280px] md:w-full md:rounded-card"
				/>

				<div className="pt-3 md:pt-0">
					<p className="mb-1.5 font-mono text-[9px] text-brand-red uppercase tracking-[0.1em] md:mb-2 md:text-[10px] md:tracking-[0.12em]">
						Em alta · {formatRelativeTime(displayTimestamp(article))}
					</p>

					<h2 className="text-pretty font-extrabold text-[21px] leading-[1.14] tracking-[-0.02em] group-hover:text-brand-red md:mb-2.5 md:text-[30px] md:leading-[1.08] md:tracking-[-0.03em]">
						{article.title}
					</h2>

					<p className="mt-2 hidden font-serif text-[15.5px] text-ink-muted leading-normal md:mt-0 md:block">
						{article.standfirst}
					</p>
				</div>
			</Link>
		</article>
	);
}
