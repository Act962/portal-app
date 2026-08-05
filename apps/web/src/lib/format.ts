/**
 * Every date is formatted in the newsroom's timezone rather than the server's,
 * so a deploy region change can never shift a publication time by three hours.
 */
const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

const clockFormatter = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
});

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	day: "2-digit",
	month: "short",
	year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "há 12 min".
 *
 * Medido contra o relógio real. Já foi medido contra um instante fixo das
 * fixtures — o que fazia sentido quando o conteúdo era estático e as datas eram
 * relativas àquele momento, mas passou a mentir assim que o portal começou a ler
 * do banco: toda matéria publicada depois daquela data caía no piso e aparecia
 * como "há 1 min".
 *
 * Não há risco de divergência de hidratação: o portal `(site)` é todo renderizado
 * no servidor. O parâmetro `now` continua injetável para os testes.
 */
export function formatRelativeTime(
	iso: string,
	now: Date = new Date(),
): string {
	const elapsed = now.getTime() - Date.parse(iso);

	if (elapsed < HOUR) {
		return `há ${Math.max(1, Math.round(elapsed / MINUTE))} min`;
	}

	if (elapsed < DAY) {
		const hours = Math.round(elapsed / HOUR);
		return hours === 1 ? "há 1 hora" : `há ${hours} horas`;
	}

	const days = Math.round(elapsed / DAY);
	return days === 1 ? "ontem" : `há ${days} dias`;
}

/** "10:24" — used where the reader needs the exact slot, not the distance. */
export function formatClock(iso: string): string {
	return clockFormatter.format(new Date(iso));
}

/**
 * "03 AGO 2026 · 08:14".
 *
 * Built from parts because pt-BR renders "03 de ago. de 2026", and the
 * connectors read as noise in a byline.
 */
export function formatByline(iso: string): string {
	const date = new Date(iso);
	const parts = dayMonthFormatter.formatToParts(date);
	const partValue = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value.replace(".", "") ?? "";

	const day = `${partValue("day")} ${partValue("month")} ${partValue("year")}`;

	return `${day.toUpperCase()} · ${clockFormatter.format(date)}`;
}

/** "SEGUNDA, 3 DE AGOSTO DE 2026" for the masthead strip. */
export function formatLongDate(date: Date): string {
	return longDateFormatter.format(date).replace("-feira", "").toUpperCase();
}

/** Machine-readable value for `<time datetime="...">`. */
export function toDateTimeAttribute(iso: string): string {
	return new Date(iso).toISOString();
}

/** "1,2 mil" */
export function formatCompactNumber(value: number): string {
	return new Intl.NumberFormat(LOCALE, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}
