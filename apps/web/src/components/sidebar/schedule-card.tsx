import { SectionHeader } from "@portal-app/ui/components/section-header";

import { ScheduleList } from "@/components/radio/schedule-list";
import { loadSchedule } from "@/data/queries";
import { programsForDay } from "@/lib/schedule";

/**
 * Grade de hoje na coluna lateral.
 *
 * É aqui que o banco é lido e o relógio é consultado, uma vez só — a lista
 * recebe tudo pronto. Enquanto ninguém cadastrar a programação (tela
 * "Programação", no painel), o card **não aparece**: um título com nada embaixo
 * lê como página quebrada, não como "ainda não configurado".
 */
export async function ScheduleCard() {
	const schedule = await loadSchedule();

	if (schedule.length === 0) {
		return null;
	}

	const now = new Date();
	const today = programsForDay(schedule, now.getDay());

	return (
		// Full-bleed tinted band on mobile, bordered card in the desktop rail.
		<section className="-mx-4 bg-surface-alt px-4 py-5 md:mx-0 md:rounded-card md:border md:border-hairline md:bg-surface md:p-4">
			<SectionHeader
				title="Programação"
				variant="rule"
				className="mb-3 pb-0 text-sm"
			/>
			{today.length > 0 ? (
				<ScheduleList programs={today} now={now} />
			) : (
				// A grade existe, mas hoje não tem nada — dizer isso é melhor do que
				// sumir com o card num único dia da semana.
				<p className="text-meta text-sm">Sem programação para hoje.</p>
			)}
		</section>
	);
}
