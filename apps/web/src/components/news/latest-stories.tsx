import type { Article } from "@/data/types";

import { NewsCard } from "./news-card";
import { NewsRow } from "./news-row";

/**
 * "Últimas notícias" on the home page.
 *
 * The two breakpoints want genuinely different objects — a scannable list with
 * thumbnails on a phone, a three-up card grid on a wide screen — so both are
 * rendered and one is hidden. Cheaper and more reliable than measuring the
 * viewport in JavaScript, which would flash the wrong layout on first paint.
 */
export function LatestStories({
	articles,
	/**
	 * Mobile drops the secondary-stories column beside the lead, so those
	 * stories are folded into this list rather than disappearing.
	 */
	mobileArticles = articles,
}: {
	articles: Article[];
	mobileArticles?: Article[];
}) {
	return (
		<>
			<div className="md:hidden">
				{mobileArticles.map((article) => (
					<NewsRow
						key={article.slug}
						article={article}
						showStandfirst={false}
					/>
				))}
			</div>

			<div className="hidden gap-[22px] md:grid md:grid-cols-2 lg:grid-cols-3">
				{articles.map((article) => (
					<NewsCard key={article.slug} article={article} />
				))}
			</div>
		</>
	);
}
