/**
 * Datas das tabelas do painel.
 *
 * Módulo PURO — sem JSX, sem React e sem `new Date()` sem argumento (regra dos
 * testes, CLAUDE.md): o `now` entra por parâmetro, que é o que torna "há 2
 * horas" verificável sem congelar o relógio global.
 *
 * Separado de `lib/format.ts` de propósito. Aquele formata para o LEITOR do
 * portal ("03 AGO 2026 · 08:14", "há 12 min"), e é prosa; aqui a leitora é a
 * redação varrendo uma tabela de vinte linhas, onde o que vale é alinhar e
 * comparar de relance.
 */

/**
 * O fuso da redação, não o do servidor.
 *
 * Mesma razão de `lib/format.ts`: a Vercel roda em UTC, e sem isto uma matéria
 * salva às 22h de Piracuruca apareceria na lista com a data do DIA SEGUINTE.
 */
const TIME_ZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

const shortDate = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	day: "2-digit",
	month: "2-digit",
	year: "2-digit",
});

const fullDateTime = new Intl.DateTimeFormat(LOCALE, {
	timeZone: TIME_ZONE,
	day: "2-digit",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** O que a lista recebe do tRPC: `Date` no servidor, string depois do JSON. */
export type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
	if (!value) {
		return null;
	}
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "08/09/26". Traço quando não há data.
 *
 * Dois dígitos no ano porque a coluna divide espaço com cinco outras, e o
 * século nunca foi a parte ambígua de uma data de redação.
 */
export function tableDate(value: DateInput): string {
	const date = toDate(value);
	return date ? shortDate.format(date) : "—";
}

/**
 * "08 de setembro de 2026 11:32" — o valor exato, para o `title` da célula.
 *
 * A coluna mostra a forma curta; quem precisa do minuto exato passa o mouse.
 * Vazio (e não "—") quando não há data: um `title` com um traço só acrescenta
 * uma tarja cinza sem informação.
 */
export function tableDateTitle(value: DateInput): string | undefined {
	const date = toDate(value);
	return date ? fullDateTime.format(date) : undefined;
}

/**
 * "agora", "há 12 min", "há 3 h", "ontem", "há 5 dias" — e a data curta a
 * partir de uma semana.
 *
 * Mais curto que o `formatRelativeTime` do portal ("há 3 horas" vira "há 3 h")
 * porque aqui a frase divide uma célula estreita com outras cinco colunas. E
 * passada uma semana a distância deixa de informar: "há 34 dias" não diz nada
 * que "05/08/26" não diga melhor.
 *
 * Data no FUTURO devolve a forma curta em vez de "há -2 min": acontece de
 * verdade quando o relógio do navegador está adiantado em relação ao do
 * servidor, e um número negativo na tela parece defeito do painel.
 */
export function tableRelative(value: DateInput, now: Date): string {
	const date = toDate(value);
	if (!date) {
		return "—";
	}

	const elapsed = now.getTime() - date.getTime();
	if (elapsed < 0) {
		return shortDate.format(date);
	}
	if (elapsed < MINUTE) {
		return "agora";
	}
	if (elapsed < HOUR) {
		return `há ${Math.round(elapsed / MINUTE)} min`;
	}
	if (elapsed < DAY) {
		return `há ${Math.round(elapsed / HOUR)} h`;
	}

	const days = Math.round(elapsed / DAY);
	if (days === 1) {
		return "ontem";
	}
	return days < 7 ? `há ${days} dias` : shortDate.format(date);
}
