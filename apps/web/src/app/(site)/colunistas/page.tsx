import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";
import Link from "next/link";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { Timestamp } from "@/components/news/timestamp";
import { AuthorAvatar } from "@/components/people/author-avatar";
import { JsonLd } from "@/components/seo/json-ld";
import { getColumnistsWithLatest, getMostRead } from "@/data/queries";
import { routes } from "@/lib/routes";
import { breadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
	title: "Colunistas",
	description:
		"As colunas e as assinaturas em destaque da Rádio 7 Cidades: quem escreve, sobre o quê e a coluna mais recente de cada um.",
	alternates: { canonical: routes.columnists },
};

/**
 * O índice dos colunistas.
 *
 * Cada cartão leva a `/autor/{slug}` — a página que JÁ existe, com o perfil e a
 * lista de matérias — e não a uma rota de coluna própria. Duas URLs para a
 * mesma pessoa dividiriam a autoridade de busca e exigiriam canonical para não
 * competirem entre si; e a página de autor nasce das matérias, então ela existe
 * de qualquer forma.
 *
 * RSC puro, como todo o grupo `(site)`: sem providers, sem React Query.
 */
export default async function ColumnistsPage() {
	const [columnists, mostRead] = await Promise.all([
		getColumnistsWithLatest(),
		getMostRead(),
	]);

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdSlot format="sidebar" />
						<MostReadList articles={mostRead} />
					</>
				}
			>
				<PageHeading
					eyebrow="Opinião"
					title="Colunistas"
					description="Quem assina as análises e as colunas da 7 Cidades."
				/>

				{columnists.length === 0 ? (
					/* Estado vazio honesto, no mesmo tom das outras telas: explica em vez
					   de parecer defeito. */
					<p className="py-16 text-center text-ink-muted">
						Nenhum colunista cadastrado ainda. Assim que houver, eles aparecem
						aqui e no bloco da home.
					</p>
				) : (
					<ul className="grid gap-4 sm:grid-cols-2">
						{columnists.map((columnist) => (
							<li
								key={columnist.slug}
								className="flex flex-col rounded-card border border-hairline bg-surface p-4.5 transition-[colors,transform,box-shadow] duration-200 hover:-translate-y-px hover:border-brand-navy hover:shadow-sm"
							>
								<Link
									href={routes.author(columnist.slug)}
									className="flex items-start gap-3.5 text-brand-navy"
								>
									<AuthorAvatar
										photoUrl={columnist.photoUrl}
										name=""
										className="size-[62px] shrink-0 rounded-[10px]"
									/>
									<span className="min-w-0">
										<span className="block font-extrabold text-base">
											{columnist.name}
										</span>
										{columnist.beat ? (
											<span className="my-1 block font-mono text-[9.5px] text-brand-red uppercase tracking-[0.1em]">
												{columnist.beat}
											</span>
										) : null}
										{columnist.blurb ? (
											<span className="block font-serif text-[13px] text-ink-muted leading-normal">
												{columnist.blurb}
											</span>
										) : null}
									</span>
								</Link>

								{/*
								  A coluna mais recente. Quem ainda não publicou não ganha um
								  bloco vazio: o cadastro costuma vir ANTES da primeira coluna,
								  e "nenhuma matéria" escrito na tela leria como defeito.
								*/}
								{columnist.latest ? (
									<div className="mt-3.5 border-hairline border-t pt-3">
										<h2 className="mb-1.5 font-mono text-[9px] text-meta uppercase tracking-[0.16em]">
											Última coluna
										</h2>
										<Link
											href={routes.article(
												columnist.latest.sectionSlug,
												columnist.latest.slug,
											)}
											className="block font-bold text-[13.5px] text-brand-navy leading-snug hover:text-brand-red"
										>
											{columnist.latest.title}
										</Link>
										<p className="mt-1 font-mono text-[9.5px] text-meta">
											<Timestamp
												iso={columnist.latest.publishedAt}
												variant="byline"
											/>
											{columnist.articleCount > 1 ? (
												<span>
													{" "}
													· {columnist.articleCount} MATÉRIAS ASSINADAS
												</span>
											) : null}
										</p>
									</div>
								) : null}
							</li>
						))}
					</ul>
				)}
			</ContentWithSidebar>

			<JsonLd
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: "Colunistas", path: routes.columnists },
				])}
			/>
		</>
	);
}
