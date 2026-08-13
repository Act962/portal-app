import { Container } from "@portal-app/ui/components/container";
import Link from "next/link";

import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

/** Breaking-news strip under the masthead. */
export function NewsTicker({ articles }: { articles: Article[] }) {
	if (articles.length === 0) {
		return null;
	}

	return (
		// The ticker duplicates the "Últimas notícias" list that sits high on the
		// mobile home page, so it only earns its space from `md` up.
		<section
			aria-label="Últimas notícias"
			className="hidden border-hairline border-b bg-surface md:block"
		>
			<Container className="flex h-[42px] items-center gap-4 overflow-hidden">
				<span className="shrink-0 rounded-tag bg-brand-red px-2 py-1 font-mono text-[10px] text-white tracking-[0.14em]">
					ÚLTIMAS
				</span>

				<ul className="rail flex gap-6 whitespace-nowrap">
					{articles.map((article) => (
						<li key={article.slug}>
							<Link
								href={routes.article(article.sectionSlug, article.slug)}
								className="font-semibold text-[13.5px] text-brand-deep hover:text-brand-red"
							>
								{article.title}
							</Link>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
