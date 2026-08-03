import { cn } from "@portal-app/ui/lib/utils";
import Link from "next/link";

import { LIVE_SHOW } from "@/data/radio";
import { routes } from "@/lib/routes";

import { OnAirDot } from "./on-air-dot";
import { PlayButton } from "./play-button";

/**
 * Compact live control in the desktop masthead. The play button toggles audio
 * in place; the label navigates to the full live page.
 */
export function LivePlayerPill({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center gap-3 bg-brand-red py-2 pr-3.5 pl-2.5",
				className,
			)}
		>
			<PlayButton />
			<Link href={routes.live} className="block text-white hover:text-white">
				<span className="flex items-center gap-1.5 font-mono text-[9px] text-white/85 tracking-[0.16em]">
					<OnAirDot />
					AO VIVO
				</span>
				<span className="font-bold text-[13px]">{LIVE_SHOW.name}</span>
			</Link>
		</div>
	);
}
