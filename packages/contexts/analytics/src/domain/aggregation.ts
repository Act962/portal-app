import type { TrafficSource } from "./traffic-source";
import { TRAFFIC_SOURCES } from "./traffic-source";

/** Uma visualização já registrada, na forma mínima que as agregações usam. */
export type PageViewRecord = {
	articleSlug: string;
	occurredAt: Date;
	/** `null` quando o leitor saiu antes de a medição fechar. */
	readingSeconds: number | null;
	source: TrafficSource;
};

export type DailyCount = { day: string; views: number };
export type SourceBreakdown = { source: TrafficSource; views: number };
export type ArticleReadingTime = {
	articleSlug: string;
	views: number;
	averageSeconds: number;
};

/**
 * Agregações do painel de insights (A38). São funções PURAS sobre registros já
 * lidos: nada de `new Date()` escondido, nada de I/O. É o que permite testá-las
 * com fixtures fixas, sem banco.
 *
 * O recorte por período NÃO acontece aqui — quem lê do banco já filtra por
 * `from`/`to` (índice em `occurredAt`), então trazer tudo para memória só para
 * filtrar de novo seria desperdício.
 */

/**
 * Visualizações por dia, no fuso da redação. `timeZone` entra por parâmetro
 * porque o servidor roda em UTC e a virada do dia importa: uma visita às 22h de
 * Teresina é 01h do dia seguinte em UTC, e agrupar pelo fuso errado joga o
 * movimento da noite para o dia errado no gráfico.
 *
 * Dias sem visualização aparecem com zero — um gráfico de linha com buraco
 * mente sobre a forma da curva.
 */
export function viewsByDay(
	records: readonly PageViewRecord[],
	range: { from: Date; to: Date },
	timeZone: string,
): DailyCount[] {
	const counts = new Map<string, number>();
	for (const record of records) {
		const day = dayKey(record.occurredAt, timeZone);
		counts.set(day, (counts.get(day) ?? 0) + 1);
	}

	const days: DailyCount[] = [];
	for (const day of eachDay(range.from, range.to, timeZone)) {
		days.push({ day, views: counts.get(day) ?? 0 });
	}
	return days;
}

/**
 * Quantas visualizações vieram de cada origem. Todas as origens aparecem,
 * inclusive as zeradas — a ausência de "social" é informação editorial, não
 * uma categoria que some do gráfico.
 */
export function viewsBySource(
	records: readonly PageViewRecord[],
): SourceBreakdown[] {
	const counts = new Map<TrafficSource, number>(
		TRAFFIC_SOURCES.map((source) => [source, 0]),
	);
	for (const record of records) {
		counts.set(record.source, (counts.get(record.source) ?? 0) + 1);
	}
	return TRAFFIC_SOURCES.map((source) => ({
		source,
		views: counts.get(source) ?? 0,
	}));
}

/**
 * Tempo MÉDIO de leitura por matéria, do maior para o menor.
 *
 * Registros sem `readingSeconds` (leitor fechou a aba antes de a medição
 * fechar) ficam fora da média — contá-los como zero puxaria o número para
 * baixo e faria toda matéria parecer mal lida. `views` devolve quantas
 * visualizações de fato entraram na conta, para a tela poder mostrar em cima
 * de quantas leituras a média foi calculada.
 */
export function averageReadingTimeByArticle(
	records: readonly PageViewRecord[],
): ArticleReadingTime[] {
	const totals = new Map<string, { sum: number; count: number }>();
	for (const record of records) {
		if (record.readingSeconds === null) {
			continue;
		}
		const current = totals.get(record.articleSlug) ?? { sum: 0, count: 0 };
		current.sum += record.readingSeconds;
		current.count += 1;
		totals.set(record.articleSlug, current);
	}

	return [...totals.entries()]
		.map(([articleSlug, { sum, count }]) => ({
			articleSlug,
			views: count,
			averageSeconds: Math.round(sum / count),
		}))
		.sort((a, b) => b.averageSeconds - a.averageSeconds);
}

/** Média geral de leitura no período, em segundos. `null` quando não há medida. */
export function overallAverageReadingSeconds(
	records: readonly PageViewRecord[],
): number | null {
	const measured = records.filter((record) => record.readingSeconds !== null);
	if (measured.length === 0) {
		return null;
	}
	const sum = measured.reduce(
		(total, record) => total + (record.readingSeconds as number),
		0,
	);
	return Math.round(sum / measured.length);
}

/** `YYYY-MM-DD` do instante, no fuso informado. */
function dayKey(date: Date, timeZone: string): string {
	// `en-CA` porque seu formato de data curto JÁ é `YYYY-MM-DD` — evita montar
	// a string à mão a partir das partes.
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

/** Todos os dias do intervalo (inclusive nas duas pontas), como `YYYY-MM-DD`. */
function eachDay(from: Date, to: Date, timeZone: string): string[] {
	const days: string[] = [];
	const seen = new Set<string>();
	// Avança de 12 em 12 horas em vez de 24: com passo de um dia exato, uma
	// mudança de horário de verão no meio do intervalo pularia ou repetiria um
	// dia. O `Set` absorve as repetições que o passo menor gera.
	for (
		let cursor = from.getTime();
		cursor <= to.getTime() + 12 * 3600_000;
		cursor += 12 * 3600_000
	) {
		const day = dayKey(new Date(cursor), timeZone);
		if (day <= dayKey(to, timeZone) && !seen.has(day)) {
			seen.add(day);
			days.push(day);
		}
	}
	return days;
}
