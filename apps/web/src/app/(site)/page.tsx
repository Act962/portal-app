import { AdSlot } from "@portal-app/ui/components/ad-slot";
import { Container } from "@portal-app/ui/components/container";
import { ctaButtonVariants } from "@portal-app/ui/components/cta-button";
import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { VideoShowcase } from "@/components/media/video-showcase";
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
import { VIDEOS } from "@/data/videos";
import { routes } from "@/lib/routes";
import { websiteSchema } from "@/lib/structured-data";

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
	] = await Promise.all([
		getHeadline(),
		getHomeBlocks(),
		getMostRead(),
		getSections(),
		getSecondaryStories(),
		getLatest(),
		loadCurrentPoll(),
		getColumnists(),
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
				<div className="grid gap-stack border-brand-navy pb-stack lg:grid-cols-[1.55fr_1fr] lg:border-b-[3px]">
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
								className="font-mono text-[10px] text-brand-red md:text-[11px]"
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
				<VideoShowcase videos={VIDEOS} />
				{/* Sem colunista cadastrado o bloco não aparece — mesma decisão da
				    grade de programação: seção vazia com título é pior que seção
				    nenhuma. */}
				{columnists.length > 0 ? (
					<ColumnistGrid columnists={columnists} />
				) : null}
			</Container>

			<JsonLd schema={websiteSchema()} />
		</>
	);
}
