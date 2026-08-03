import { cn } from "@portal-app/ui/lib/utils";

import { SCHEDULE } from "@/data/radio";

const STATUS_LABEL = {
	"on-air": "NO AR",
	live: "AO VIVO",
} as const;

/**
 * Today's programming grid. `tone` switches it between the light sidebar card
 * and the navy band on the live page.
 */
export function ScheduleList({
	tone = "light",
	showHost = false,
}: {
	tone?: "light" | "dark";
	showHost?: boolean;
}) {
	const isDark = tone === "dark";

	return (
		<ul>
			{SCHEDULE.map((program) => (
				<li
					key={program.id}
					className={cn(
						"flex items-center gap-3 border-t py-2.5 first:border-t-0",
						isDark ? "border-white/15" : "border-hairline",
					)}
				>
					<span
						className={cn(
							"w-10 shrink-0 font-mono text-[11.5px]",
							isDark ? "text-on-navy-muted" : "text-brand-navy",
						)}
					>
						{program.hour}
					</span>

					<span className="min-w-0 flex-1">
						<span
							className={cn(
								"block truncate font-semibold text-[13.5px]",
								isDark ? "text-white" : "text-brand-navy",
							)}
						>
							{program.name}
						</span>
						{showHost ? (
							<span className="mt-0.5 block font-mono text-[9.5px] text-on-navy-dim">
								{program.host}
							</span>
						) : null}
					</span>

					{program.status ? (
						<span className="shrink-0 font-mono text-[8.5px] text-brand-red tracking-[0.1em]">
							{STATUS_LABEL[program.status]}
						</span>
					) : null}
				</li>
			))}
		</ul>
	);
}
