import type { ProgramRow } from "@/data/queries";

/**
 * Está no ar neste instante? Mesma regra de `Program.isLiveAt` (Bloco 2,
 * `@portal-app/broadcast`) — reimplementada aqui, e não reconstruindo o
 * agregado, porque o read model do portal já devolve linhas simples (sem
 * `order`, que não importa para esta conta). `now` entra por parâmetro
 * (nunca `new Date()` escondido) para o teste poder congelar o tempo.
 * Início inclusivo, fim exclusivo.
 */
export function isProgramLive(program: ProgramRow, now: Date): boolean {
	if (now.getDay() !== program.dayOfWeek) {
		return false;
	}
	const minutesNow = now.getHours() * 60 + now.getMinutes();
	return (
		minutesNow >= toMinutes(program.startTime) &&
		minutesNow < toMinutes(program.endTime)
	);
}

/** Programas de um dia da semana, na ordem em que já vêm do read model. */
export function programsForDay(
	programs: ProgramRow[],
	dayOfWeek: number,
): ProgramRow[] {
	return programs.filter((program) => program.dayOfWeek === dayOfWeek);
}

function toMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return (hours ?? 0) * 60 + (minutes ?? 0);
}
