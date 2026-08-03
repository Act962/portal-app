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
import { PollCard } from "@/components/sidebar/poll-card";
import { ScheduleCard } from "@/components/sidebar/schedule-card";
import { WhatsappCard } from "@/components/sidebar/whatsapp-card";
import { COLUMNISTS } from "@/data/columnists";
import { WEEKLY_POLL } from "@/data/poll";
import {
	getHeadline,
	getHomeBlocks,
	getLatest,
	getMostRead,
	getSecondaryStories,
	getSections,
} from "@/data/queries";
import { VIDEOS } from "@/data/videos";
import { routes } from "@/lib/routes";

export default function HomePage() {
	const headline = getHeadline();
	const blocks = getHomeBlocks();

	return (
		<>
			<ContentWithSidebar
				sidebar={
					<>
						<MostReadList articles={getMostRead()} period="24H" />
						<AdSlot format="sidebar" />
						<PollCard poll={WEEKLY_POLL} />

						{/* A directory of sections replaces the desktop nav rail on a phone. */}
						<section className="lg:hidden">
							<SectionHeader title="Editorias" className="mb-3" />
							<SectionGrid sections={getSections()} />
						</section>

						<ScheduleCard />
						<WhatsappCard />
						<AdSlot format="sidebar-tall" className="hidden lg:block" />
					</>
				}
			>
				<div className="grid gap-stack border-brand-navy pb-stack lg:grid-cols-[1.55fr_1fr] lg:border-b-[3px]">
					<HeroStory article={headline} />
					<SecondaryStoryList articles={getSecondaryStories()} />
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
						articles={getLatest()}
						mobileArticles={[...getSecondaryStories(), ...getLatest()].slice(
							0,
							6,
						)}
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
				<ColumnistGrid columnists={COLUMNISTS} />
			</Container>
		</>
	);
}
