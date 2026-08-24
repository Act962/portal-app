import { AdSlot } from "@portal-app/ui/components/ad-slot";
import { Container } from "@portal-app/ui/components/container";
import { ctaButtonVariants } from "@portal-app/ui/components/cta-button";
import { SectionHeader } from "@portal-app/ui/components/section-header";
import type { Metadata } from "next";
import Link from "next/link";

import { QuotesBand } from "@/components/finance/quotes-band";
import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { HeroStory } from "@/components/news/hero-story";
import { LatestStories } from "@/components/news/latest-stories";
import { MostReadList } from "@/components/news/most-read-list";
import { SecondaryStoryList } from "@/components/news/secondary-story-list";
import { SectionBlock } from "@/components/news/section-block";
import { SectionGrid } from "@/components/news/section-grid";
import { ColumnistGrid } from "@/components/people/columnist-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { PollCard } from "@/components/sidebar/poll-card";
import { ScheduleCard } from "@/components/sidebar/schedule-card";
import { WhatsappCard } from "@/components/sidebar/whatsapp-card";
import { loadCurrentPoll } from "@/data/polls";
import {
	getColumnists,
	getHeadline,
	getHomeBlocks,
	getLatest,
	getMostRead,
	getSecondaryStories,
	getSections,
} from "@/data/queries";
import { loadQuotes } from "@/data/quotes";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { pageMetadata } from "@/lib/seo/metadata";
import {
	articleListItems,
	collectionPageSchema,
	websiteSchema,
} from "@/lib/structured-data";

/**
 * A home não tinha metadata própria (spec 07, A3): herdava título e descrição da
 * raiz e ficava SEM canônica — a página mais importante do portal era a única
 * que não dizia qual é a sua URL. `pageMetadata` também traz o `og:image`
 * gerado, que é o que faz o link do portal no WhatsApp sair com imagem.
 *
 * O título é ABSOLUTO: passar pelo template daria "Início | Rádio 7 Cidades",
 * com a marca repetida, e é o `<title>` da home que o Google costuma usar como
 * nome do site na SERP.
 */
export async function generateMetadata(): Promise<Metadata> {
	const site = await loadSiteIdentity();

	return pageMetadata({
		site,
		titleAbsolute: `${site.name} — Notícias de ${site.city} e região`,
		description: site.description,
		path: routes.home,
		eyebrow: site.shortName,
		rss: { path: "/rss.xml", title: `${site.name} — Últimas notícias` },
	});
}

export default async function HomePage() {
	const [
		headline,
		blocks,
		mostRead,
		sections,
		secondary,
		latest,
		poll,
		columnists,
		quotes,
		site,
	] = await Promise.all([
		getHeadline(),
		getHomeBlocks(),
		getMostRead(),
		getSections(),
		getSecondaryStories(),
		getLatest(),
		loadCurrentPoll(),
		getColumnists(),
		// Em paralelo com as leituras do banco, e não em série: é uma chamada de
		// REDE a um terceiro, e enfileirá-la depois das outras somaria a latência
		// dela ao tempo de resposta da home.
		loadQuotes(),
		loadSiteIdentity(),
	]);

	// Portal recém-migrado / sem publicações ainda: estado vazio honesto.
	if (!headline) {
		return (
			<ContentWithSidebar sidebar={null}>
				<div className="py-16 text-center text-ink-muted">
					<p className="font-bold text-lg">Ainda não há matérias publicadas.</p>
					<p className="mt-1 text-sm">
						Publique uma matéria no painel para vê-la aqui.
					</p>
				</div>
			</ContentWithSidebar>
		);
	}

	return (
		<>
			<ContentWithSidebar
				sidebar={
					<>
						<MostReadList articles={mostRead} period="24H" />
						<AdSlot format="sidebar" />
						<PollCard poll={poll} />

						{/* A directory of sections replaces the desktop nav rail on a phone. */}
						<section className="lg:hidden">
							<SectionHeader title="Editorias" className="mb-3" />
							<SectionGrid sections={sections} />
						</section>

						<ScheduleCard />
						<WhatsappCard />
						<AdSlot format="sidebar-tall" className="hidden lg:block" />
					</>
				}
			>
				<div className="grid gap-stack border-brand-deep pb-stack lg:grid-cols-[1.55fr_1fr] lg:border-b-[3px]">
					<HeroStory article={headline} />
					<SecondaryStoryList articles={secondary} />
				</div>

				<AdSlot format="mobile-top" className="mt-3.5 md:hidden" />

				<section className="pt-stack">
					<SectionHeader
						title="Últimas notícias"
						className="mb-3 md:mb-4"
						action={
							<Link
								href={routes.latest}
								className="font-mono text-[10px] text-brand-accent-ink md:text-[11px]"
							>
								VER TODAS →
							</Link>
						}
					/>

					<LatestStories
						articles={latest}
						mobileArticles={[...secondary, ...latest].slice(0, 6)}
					/>

					<Link
						href={routes.latest}
						className={`${ctaButtonVariants({ variant: "outline" })} mt-4 md:hidden`}
					>
						Carregar mais notícias
					</Link>
				</section>

				<AdSlot format="in-content" className="mt-section hidden md:block" />

				{/* Desktop only: on a phone these repeat the "Últimas" list and the
				    section directory that already sit above them. */}
				<div className="mt-section hidden gap-section md:grid md:grid-cols-2">
					{blocks.map((block) => (
						<SectionBlock key={block.section.slug} block={block} />
					))}
				</div>
			</ContentWithSidebar>

			<Container>
				{/* No lugar da antiga faixa "TV 7 Cidades", que era fixture. Ao
				    contrário dela, esta some sozinha quando não há o que mostrar —
				    a API é de terceiro e pode falhar, e a home não pode depender
				    disso para ficar inteira. */}
				<QuotesBand quotes={quotes} />

				{/* Sem colunista cadastrado o bloco não aparece — mesma decisão da
				    grade de programação: seção vazia com título é pior que seção
				    nenhuma. */}
				{columnists.length > 0 ? (
					<ColumnistGrid columnists={columnists} />
				) : null}
			</Container>

			<JsonLd schema={websiteSchema(site)} />

			{/*
			  A capa do dia como `ItemList` (spec 07, A14): diz ao buscador QUAIS
			  matérias o portal está destacando agora e em que ordem. É o sinal que
			  o Google usa para escolher o que sobe ao carrossel de Top Stories —
			  sem ele, a home era só um bloco de links para o rastreador.
			*/}
			<JsonLd
				schema={collectionPageSchema({
					site,
					name: `${site.name} — Capa`,
					description: site.description,
					path: routes.home,
					items: articleListItems([headline, ...secondary, ...latest]),
				})}
			/>
		</>
	);
}
