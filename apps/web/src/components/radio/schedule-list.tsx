import type { ProgramRow } from "@/data/queries";
import { isProgramLive } from "@/lib/schedule";

/**
 * Grade de um dia. Recebe os programas já filtrados e o `now` de quem chama —
 * não lê o banco nem o relógio. Isso mantém a decisão de "quem está no ar" numa
 * função pura e testável (`isProgramLive`) e deixa este arquivo com só a
 * marcação.
 */
export function ScheduleList({
	programs,
	now,
}: {
	programs: ProgramRow[];
	now: Date;
}) {
	return (
		<ul>
			{programs.map((program) => (
				<li
					key={program.id}
					className="flex items-center gap-3 border-hairline border-t py-2.5 first:border-t-0"
				>
					<span className="w-12 shrink-0 font-mono text-[11.5px] text-brand-ink">
						{program.startTime}
					</span>

					<span className="min-w-0 flex-1">
						<span className="block truncate font-semibold text-[13.5px] text-brand-ink">
							{program.name}
						</span>
					</span>

					{isProgramLive(program, now) ? (
						<span className="shrink-0 font-mono text-[8.5px] text-brand-accent-ink tracking-[0.1em]">
							NO AR
						</span>
					) : null}
				</li>
			))}
		</ul>
	);
}
