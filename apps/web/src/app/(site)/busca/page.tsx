import { Chip } from "@portal-app/ui/components/chip";
import { Container } from "@portal-app/ui/components/container";
import type { Metadata } from "next";
import Link from "next/link";

import { NewsRow } from "@/components/news/news-row";
import { SearchBox } from "@/components/search/search-box";
import { getLatest, loadSiteSettings, searchArticles } from "@/data/queries";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
	const site = await loadSiteIdentity();

	return pageMetadata({
		site,
		title: "Busca",
		description: `Busque notícias, programas e cidades no portal da ${site.name}.`,
		path: routes.search,
		eyebrow: "Busca",
		// Uma página de resultados não tem nada de único a oferecer ao índice — e
		// há uma URL por termo digitado. O `robots.txt` corta antes do rastreio
		// (spec 07, D6); este `noindex` é o cinto para o que já tiver entrado.
		index: false,
	});
}

const EYEBROW = "font-mono text-[10px] tracking-[0.16em] text-meta uppercase";

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim() ?? "";
	const [results, recent, site] = await Promise.all([
		searchArticles(query),
		getLatest(3),
		loadSiteSettings(),
	]);
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
							{site.popularSearches.map((term) => (
								<Link key={term} href={routes.searchFor(term)}>
									<Chip className="font-semibold text-brand-deep text-sm">
										{term}
									</Chip>
								</Link>
							))}
						</div>
					</section>

					<section>
						<h2 className={`${EYEBROW} mb-3`}>Publicadas recentemente</h2>
						{recent.map((article) => (
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
