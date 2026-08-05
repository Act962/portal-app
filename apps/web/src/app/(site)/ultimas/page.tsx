import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { ArticleList } from "@/components/news/article-list";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { getAllArticles, getMostRead } from "@/data/queries";
import { paginate, parsePageParam } from "@/lib/pagination";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Últimas notícias",
	description:
		"Tudo o que foi publicado no portal da Rádio 7 Cidades, da mais recente para a mais antiga.",
	alternates: { canonical: routes.latest },
};

export default async function LatestPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	const { page } = await searchParams;
	const [all, mostRead] = await Promise.all([getAllArticles(), getMostRead()]);
	const listing = paginate(all, parsePageParam(page));

	return (
		<ContentWithSidebar
			sidebar={
				<>
					<AdSlot format="sidebar" />
					<MostReadList articles={mostRead} period="24H" />
				</>
			}
		>
			<PageHeading eyebrow="Cobertura" title="Últimas notícias" />

			<ArticleList
				articles={listing.items}
				currentPage={listing.currentPage}
				totalPages={listing.totalPages}
				basePath={routes.latest}
			/>
		</ContentWithSidebar>
	);
}
