import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import type { HomeBlock } from "@/data/queries";
import { routes } from "@/lib/routes";

import { NewsCard } from "./news-card";
import { NewsHeadlineItem } from "./news-headline-item";

/** One editorial section on the home page: a lead story plus a headline list. */
export function SectionBlock({ block }: { block: HomeBlock }) {
	return (
		<section>
			<SectionHeader
				title={block.section.name}
				variant="rule"
				className="mb-3.5"
				action={
					<Link
						href={routes.section(block.section.slug)}
						className="font-mono text-[10.5px] text-brand-accent-ink"
					>
						VER MAIS +
					</Link>
				}
			/>

			<NewsCard
				article={block.lead}
				size="lg"
				showTimestamp={false}
				className="mb-3"
			/>

			<ul>
				{block.items.map((article) => (
					<NewsHeadlineItem key={article.slug} article={article} />
				))}
			</ul>
		</section>
	);
}
