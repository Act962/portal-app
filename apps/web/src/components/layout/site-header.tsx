import { AdSlot } from "@portal-app/ui/components/ad-slot";
import { Container } from "@portal-app/ui/components/container";
import { Menu, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LivePlayerPill } from "@/components/radio/live-player-pill";
import { siteConfig } from "@/config/site";
import { loadSiteSettings } from "@/data/queries";
import { routes } from "@/lib/routes";

const ICON_BUTTON =
	"flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20";

/**
 * Masthead. Two quite different designs share this markup:
 * navy and compact with icon actions on mobile, white and wide with the live
 * pill and a banner slot from `md` up.
 */
export async function SiteHeader() {
	const site = await loadSiteSettings();

	return (
		<header className="border-hairline bg-brand-navy md:border-b md:bg-surface">
			<Container className="flex flex-wrap items-center gap-3 py-2 md:gap-6 md:py-4">
				<Link
					href={routes.home}
					className="flex shrink-0 items-center gap-2.5 text-white hover:text-white md:gap-3 md:text-brand-navy md:hover:text-brand-navy"
				>
					<Image
						// Logo enviado pela biblioteca (D8); sem ele, o arquivo estático.
						src={site.logoUrl ?? siteConfig.logo}
						alt=""
						width={52}
						height={52}
						unoptimized
						priority
						className="block size-[34px] rounded-[9px] md:size-[52px] md:rounded-xl"
					/>
					<span className="flex flex-col gap-px md:gap-[3px]">
						<span className="font-extrabold text-[15px] uppercase leading-none tracking-[-0.01em] md:text-[25px] md:tracking-[-0.025em]">
							<span className="md:hidden">{site.shortName}</span>
							<span className="hidden md:inline">{site.name}</span>
						</span>
						<span className="font-mono text-[9px] text-on-navy-muted tracking-[0.14em] md:text-[10px] md:text-meta md:tracking-[0.16em]">
							<span className="md:hidden">NOTÍCIAS · {site.radioBand}</span>
							<span className="hidden md:inline">{site.tagline}</span>
						</span>
					</span>
				</Link>

				<LivePlayerPill className="hidden md:flex" />

				<div className="flex-1" />

				<div className="flex items-center gap-2 md:hidden">
					<Link
						href={routes.search}
						className={ICON_BUTTON}
						aria-label="Buscar"
					>
						<Search size={16} aria-hidden />
					</Link>
					<Link href={routes.menu} className={ICON_BUTTON} aria-label="Menu">
						<Menu size={16} aria-hidden />
					</Link>
				</div>

				<AdSlot format="header-desktop" className="hidden min-w-60 lg:block" />
			</Container>
		</header>
	);
}
