import { Kicker } from "@portal-app/ui/components/kicker";
import Link from "next/link";
import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";
import { ArticleThumb } from "./article-thumb";

/** Column of supporting stories next to the home page lead. */
export function SecondaryStoryList({ articles }: { articles: Article[] }) {
	return (
		// Mobile has no room for a second column beside the lead; these stories
		// are folded into "Últimas notícias" there instead.
		<ul className="hidden flex-col lg:flex">
			{articles.map((article) => (
				<li key={article.slug} className="border-hairline border-t">
					<Link
						href={routes.article(article.sectionSlug, article.slug)}
						className="group flex flex-col gap-2.5 py-4 text-brand-navy hover:text-brand-navy"
					>
						<ArticleThumb article={article} className="h-[130px] w-full" />
						<Kicker variant="text">{article.kicker}</Kicker>
						<h3 className="text-pretty font-bold text-[19px] leading-tight tracking-[-0.015em] group-hover:text-brand-red">
							{article.title}
						</h3>
					</Link>
				</li>
			))}
		</ul>
	);
}
