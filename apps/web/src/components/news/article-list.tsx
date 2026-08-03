import type { Article } from "@/data/types";

import { NewsRow } from "./news-row";
import { Pagination } from "./pagination";

type ArticleListProps = {
	articles: Article[];
	currentPage: number;
	totalPages: number;
	basePath: string;
	emptyMessage?: string;
};

/** Paginated listing shared by the section pages and "Últimas notícias". */
export function ArticleList({
	articles,
	currentPage,
	totalPages,
	basePath,
	emptyMessage = "Nenhuma matéria publicada nesta editoria ainda.",
}: ArticleListProps) {
	if (articles.length === 0) {
		return (
			<p className="py-10 font-serif text-ink-muted text-lg">{emptyMessage}</p>
		);
	}

	return (
		<>
			<div>
				{articles.map((article) => (
					<NewsRow key={article.slug} article={article} />
				))}
			</div>

			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				basePath={basePath}
			/>
		</>
	);
}
