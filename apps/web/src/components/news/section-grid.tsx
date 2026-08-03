import { cn } from "@portal-app/ui/lib/utils";
import Link from "next/link";

import { getArticlesBySection } from "@/data/queries";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

/**
 * Two-column directory of sections. Used on the mobile home page and as the
 * body of the menu screen, which is why it carries a tone switch.
 */
export function SectionGrid({
	sections,
	tone = "light",
	showCounts = true,
	className,
}: {
	sections: Section[];
	tone?: "light" | "dark";
	showCounts?: boolean;
	className?: string;
}) {
	const isDark = tone === "dark";

	return (
		<ul className={cn("grid grid-cols-2 gap-2", className)}>
			{sections.map((section) => {
				const total = getArticlesBySection(section.slug).length;

				return (
					<li key={section.slug}>
						<Link
							href={routes.section(section.slug)}
							className={cn(
								"flex min-h-11 flex-col justify-center gap-1 rounded-card border px-3 py-3",
								isDark
									? "border-white/20 text-white hover:border-brand-red hover:bg-brand-red hover:text-white"
									: "border-hairline bg-surface text-brand-navy hover:border-brand-navy hover:text-brand-navy",
							)}
						>
							<span
								className={cn(
									"font-bold",
									isDark ? "text-[14.5px]" : "text-sm",
								)}
							>
								{section.name}
							</span>
							{showCounts ? (
								<span className="font-mono text-[9.5px] text-meta">
									{total} {total === 1 ? "matéria" : "matérias"}
								</span>
							) : null}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
