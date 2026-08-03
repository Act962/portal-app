import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import { SectionHeader } from "@portal-app/ui/components/section-header";
import { Play } from "lucide-react";
import Link from "next/link";

import type { Video } from "@/data/types";
import { routes } from "@/lib/routes";

/** Navy band showcasing the outlet's video output. */
export function VideoShowcase({ videos }: { videos: Video[] }) {
	return (
		<section className="-mx-4 mt-6 bg-brand-navy px-4 py-5 md:mx-0 md:mt-section md:rounded-panel md:px-7 md:py-stack">
			<SectionHeader
				title="TV 7 Cidades"
				tone="dark"
				className="mb-4.5"
				action={
					<Link
						href={routes.search}
						className="font-mono text-[11px] text-brand-red-soft"
					>
						MAIS VÍDEOS →
					</Link>
				}
			/>

			<ul className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
				{videos.map((video) => (
					<li key={video.id}>
						<div className="relative mb-2.5">
							<MediaPlaceholder tone="dark" className="h-[130px] w-full" />
							<Play
								aria-hidden
								size={26}
								fill="currentColor"
								strokeWidth={0}
								className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80"
							/>
						</div>
						<p className="mb-1.5 font-mono text-[9.5px] text-on-navy-muted tracking-[0.1em]">
							{video.duration}
						</p>
						<h3 className="text-pretty font-bold text-[15px] text-white leading-snug">
							{video.title}
						</h3>
					</li>
				))}
			</ul>
		</section>
	);
}
