import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import type { Columnist } from "@/data/types";
import { routes } from "@/lib/routes";

export function ColumnistGrid({ columnists }: { columnists: Columnist[] }) {
	return (
		<section className="mt-6 md:mt-section">
			<SectionHeader title="Colunistas" className="mb-4" />

			<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{columnists.map((columnist) => (
					<li key={columnist.slug}>
						<Link
							href={routes.section(columnist.sectionSlug)}
							className="flex items-center gap-3.5 rounded-card border border-hairline bg-surface p-4.5 text-brand-navy transition-colors hover:border-brand-navy hover:text-brand-navy"
						>
							<span
								aria-hidden
								className="hatch-light size-[62px] shrink-0 rounded-[10px]"
							/>
							<span>
								<span className="block font-extrabold text-base">
									{columnist.name}
								</span>
								<span className="my-1 block font-mono text-[9.5px] text-brand-red tracking-[0.1em]">
									{columnist.beat}
								</span>
								<span className="block font-serif text-[13px] text-ink-muted leading-normal">
									{columnist.blurb}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
