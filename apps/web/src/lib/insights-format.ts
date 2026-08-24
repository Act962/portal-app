/**
 * Formatação do painel de insights. Funções PURAS — sem `new Date()` escondido,
 * sem I/O — para serem testáveis direto.
 */

/** `95s` → `1min 35s`. Segundos crus não dizem nada a quem lê o painel. */
export function formatDuration(seconds: number | null): string {
	if (seconds === null) {
		return "—";
	}
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return rest === 0 ? `${minutes}min` : `${minutes}min ${rest}s`;
}

/** `2026-08-06` → `06/08`. Rótulo curto de eixo, no formato brasileiro. */
export function formatDayLabel(day: string): string {
	const [, month, date] = day.split("-");
	return `${date}/${month}`;
}

const SOURCE_LABELS: Record<string, string> = {
	direto: "Direto",
	busca: "Busca",
	social: "Redes sociais",
	interno: "Dentro do portal",
	outro: "Outros sites",
};

/** Rótulo humano da origem de tráfego. */
export function formatSource(source: string): string {
	return SOURCE_LABELS[source] ?? source;
}

/**
 * Presets do filtro de período, em dias. Devolve o intervalo com as duas
 * pontas inclusivas — `from` no começo do primeiro dia, `to` no fim de hoje —
 * porque é assim que a agregação e o eixo do gráfico contam os dias.
 *
 * `now` entra por parâmetro (regra do CLAUDE.md): sem isso não dá para testar
 * a virada de mês nem congelar o relógio.
 */
export function rangeForDays(
	days: number,
	now: Date,
): { from: Date; to: Date } {
	const to = new Date(now);
	to.setHours(23, 59, 59, 999);
	const from = new Date(now);
	from.setDate(from.getDate() - (days - 1));
	from.setHours(0, 0, 0, 0);
	return { from, to };
}
