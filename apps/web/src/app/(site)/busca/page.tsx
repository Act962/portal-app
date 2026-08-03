import { Chip } from "@portal-app/ui/components/chip";
import { Container } from "@portal-app/ui/components/container";
import type { Metadata } from "next";
import Link from "next/link";

import { NewsRow } from "@/components/news/news-row";
import { SearchBox } from "@/components/search/search-box";
import { siteConfig } from "@/config/site";
import { getLatest, searchArticles } from "@/data/queries";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Busca",
	description:
		"Busque notícias, programas e cidades no portal da Rádio 7 Cidades.",
	alternates: { canonical: routes.search },
	// A search results page has nothing unique to offer an index.
	robots: { index: false, follow: true },
};

const EYEBROW = "font-mono text-[10px] tracking-[0.16em] text-meta uppercase";

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim() ?? "";
	const results = searchArticles(query);
	const hasQuery = query.length > 0;

	return (
		<Container className="max-w-article py-4 md:py-section">
			<h1 className="sr-only">Busca no portal</h1>

			<SearchBox defaultValue={query} />

			{hasQuery ? (
				<section>
					<p className={`${EYEBROW} mb-3`}>
						{results.length === 0
							? `Nenhum resultado para “${query}”`
							: `${results.length} resultado(s) para “${query}”`}
					</p>

					{results.map((article) => (
						<NewsRow key={article.slug} article={article} />
					))}
				</section>
			) : null}

			{!hasQuery || results.length === 0 ? (
				<>
					<section className="mb-section">
						<h2 className={`${EYEBROW} mb-3`}>Buscas mais frequentes</h2>
						<div className="flex flex-wrap gap-2">
							{siteConfig.popularSearches.map((term) => (
								<Link key={term} href={routes.searchFor(term)}>
									<Chip className="font-semibold text-brand-navy text-sm">
										{term}
									</Chip>
								</Link>
							))}
						</div>
					</section>

					<section>
						<h2 className={`${EYEBROW} mb-3`}>Publicadas recentemente</h2>
						{getLatest(3).map((article) => (
							<NewsRow
								key={article.slug}
								article={article}
								showStandfirst={false}
							/>
						))}
					</section>
				</>
			) : null}
		</Container>
	);
}
