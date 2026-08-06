import { Container } from "@portal-app/ui/components/container";
import { CtaButton } from "@portal-app/ui/components/cta-button";
import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import { SectionHeader } from "@portal-app/ui/components/section-header";
import type { Metadata } from "next";

import { OnAirDot } from "@/components/radio/on-air-dot";
import { PlayButton } from "@/components/radio/play-button";
import { ScheduleList } from "@/components/radio/schedule-list";
import { siteConfig } from "@/config/site";
import { loadSiteSettings } from "@/data/queries";
import { LIVE_SHOW, TRACK_LOG } from "@/data/radio";
import { formatCompactNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Ao vivo",
	description: `Ouça a ${siteConfig.name} ${siteConfig.radio.band} ao vivo e acompanhe a programação do dia.`,
	alternates: { canonical: routes.live },
};

/**
 * Mobile centres the whole thing like a player screen and lifts the schedule
 * onto a light sheet; desktop splits it into artwork + detail columns.
 */
export default async function LivePage() {
	const site = await loadSiteSettings();

	return (
		<div className="bg-brand-navy">
			<Container className="grid items-start gap-6 py-6 text-center md:gap-12 md:py-major md:text-left lg:grid-cols-[minmax(240px,var(--container-sidebar))_minmax(0,1fr)]">
				<div className="lg:order-2">
					<p className="mb-3.5 flex items-center justify-center gap-2 font-mono text-[9px] text-brand-red tracking-[0.18em] md:justify-start md:text-[10px]">
						<OnAirDot className="size-1.5" />
						NO AR AGORA
					</p>

					<MediaPlaceholder
						tone="dark"
						label="[ arte do programa ]"
						className="mx-auto mb-4.5 size-44 rounded-[20px] lg:hidden"
					/>

					<h1 className="font-extrabold text-2xl text-white leading-none tracking-[-0.02em] md:text-4xl md:tracking-[-0.04em] lg:text-[52px]">
						{LIVE_SHOW.name}
					</h1>

					<p className="mt-1.5 font-serif text-[#b9c8d8] text-sm md:mt-2.5 md:text-lg">
						com {LIVE_SHOW.host} · {LIVE_SHOW.schedule}
					</p>

					<div className="mt-5 flex flex-col items-center gap-2 lg:hidden">
						<PlayButton size="lg" tone="solid" />
						<p className="font-mono text-[10px] text-on-navy-muted tracking-[0.12em]">
							TOQUE PARA OUVIR · {site.radioFrequency}
						</p>
					</div>
				</div>

				<div className="hidden lg:order-1 lg:block">
					<MediaPlaceholder
						tone="dark"
						label="[ arte do programa ]"
						className="mb-5 aspect-square w-full rounded-[18px]"
					/>

					<div className="flex items-center gap-4">
						<PlayButton size="lg" tone="solid" />
						<div>
							<p className="font-mono text-[10px] text-on-navy-muted tracking-[0.14em]">
								TOQUE PARA OUVIR
							</p>
							<p className="mt-1 font-bold text-[15px] text-white">
								{site.radioFrequency} ·{" "}
								{formatCompactNumber(LIVE_SHOW.listeners)} ouvindo
							</p>
						</div>
					</div>
				</div>
			</Container>

			{/* Light sheet: on a phone the schedule reads better off the navy. */}
			<div className="rounded-t-[20px] bg-canvas pt-5 pb-8 text-left lg:rounded-none lg:bg-brand-navy lg:pt-0 lg:pb-major">
				<Container className="grid gap-6 lg:grid-cols-2 lg:gap-8">
					<section>
						<SectionHeader
							title="Programação de hoje"
							className="mb-3 text-sm lg:hidden"
						/>
						<SectionHeader
							title="Programação de hoje"
							tone="dark"
							className="mb-3 hidden text-sm lg:flex"
						/>
						<div className="lg:hidden">
							<ScheduleList showHost />
						</div>
						<div className="hidden lg:block">
							<ScheduleList tone="dark" showHost />
						</div>
					</section>

					<section>
						<SectionHeader
							title="Participe"
							className="mb-3 text-sm lg:hidden"
						/>
						<SectionHeader
							title="Participe"
							tone="dark"
							className="mb-3 hidden text-sm lg:flex"
						/>

						<div className="rounded-card border border-hairline bg-surface p-4 lg:border-white/20 lg:bg-transparent lg:p-4.5">
							<p className="mb-3 font-bold text-base text-brand-navy leading-snug lg:text-[19px] lg:text-white">
								Mande seu recado ou pedido de música pelo WhatsApp da rádio
							</p>
							<CtaButton variant="secondary" className="lg:bg-brand-red">
								{site.contactWhatsapp}
							</CtaButton>
						</div>

						<ul className="mt-5 hidden flex-col lg:flex">
							{TRACK_LOG.map((entry) => (
								<li
									key={entry.at}
									className="flex items-center gap-3 border-white/15 border-t py-2.5"
								>
									<span className="w-10 shrink-0 font-mono text-[10px] text-on-navy-dim">
										{entry.at}
									</span>
									<span className="flex-1 font-semibold text-sm text-white">
										{entry.title}
									</span>
								</li>
							))}
						</ul>
					</section>
				</Container>
			</div>
		</div>
	);
}
