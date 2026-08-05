import { AnchorAd } from "@/components/layout/anchor-ad";
import { MainNav } from "@/components/layout/main-nav";
import { NewsTicker } from "@/components/layout/news-ticker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { TopBar } from "@/components/layout/top-bar";
import { LivePlayerBar } from "@/components/radio/live-player-bar";
import { LivePlayerProvider } from "@/components/radio/live-player-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { getSections, getTicker } from "@/data/queries";
import { organizationSchema } from "@/lib/structured-data";

/**
 * Public portal shell.
 *
 * `LivePlayerProvider` wraps everything so the audio element outlives route
 * changes — the reader keeps listening while they browse.
 */
export default async function SiteLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const [sections, ticker] = await Promise.all([getSections(), getTicker()]);

	return (
		<LivePlayerProvider>
			{/* Bottom padding clears the sticky anchor ad on small screens. */}
			<div className="flex min-h-svh flex-col bg-canvas pb-[68px] text-ink md:pb-0">
				<SkipLink />
				<TopBar />
				<SiteHeader />
				<LivePlayerBar />
				<MainNav sections={sections} />
				<NewsTicker articles={ticker} />

				<main id="conteudo" className="flex-1">
					{children}
				</main>

				<SiteFooter sections={sections} />
			</div>

			<AnchorAd />
			<JsonLd schema={organizationSchema()} />
		</LivePlayerProvider>
	);
}
