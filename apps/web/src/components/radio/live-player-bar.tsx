"use client";

import { Container } from "@portal-app/ui/components/container";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LIVE_SHOW } from "@/data/radio";
import { formatCompactNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

import { OnAirDot } from "./on-air-dot";
import { PlayButton } from "./play-button";

/**
 * Full-width live strip under the mobile masthead.
 *
 * Hidden on the live page itself, where the same controls are already the
 * main content — two play buttons on one screen is just confusing.
 */
export function LivePlayerBar() {
	const pathname = usePathname();

	if (pathname === routes.live) {
		return null;
	}

	return (
		<div className="bg-brand-red md:hidden">
			<Container className="flex items-center gap-2.5 py-1.5">
				<PlayButton size="sm" />

				<Link
					href={routes.live}
					className="min-w-0 flex-1 text-white hover:text-white"
				>
					<span className="flex items-center gap-1.5 font-mono text-[9px] text-white/85 tracking-[0.16em]">
						<OnAirDot />
						AO VIVO
					</span>
					<span className="block truncate font-semibold text-[12.5px]">
						{LIVE_SHOW.name} — com {LIVE_SHOW.host}
					</span>
				</Link>

				<span className="shrink-0 font-mono text-[10px] text-white/80">
					{formatCompactNumber(LIVE_SHOW.listeners)} ouvindo
				</span>
			</Container>
		</div>
	);
}
