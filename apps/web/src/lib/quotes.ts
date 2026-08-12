/**
 * Leitura da resposta da AwesomeAPI para o modelo que o portal exibe.
 *
 * Módulo PURO — sem `fetch`, sem `new Date()` sem argumento, sem JSX (regra dos
 * testes, CLAUDE.md). O que erra aqui é a interpretação do payload, e isso se
 * testa sem rede e sem montar componente. Quem busca é `data/quotes.ts`.
 *
 * A API devolve TODOS os valores como string ("bid": "5.7276"), inclusive os
 * numéricos. É a fonte de erro mais provável deste arquivo, e por isso cada
 * conversão é explícita e cada valor impossível derruba só a moeda, nunca a
 * faixa inteira.
 */

/** Os pares que a home mostra. A chave do JSON é o par SEM o hífen. */
export const HOME_PAIRS = [
	{ pair: "USD-BRL", label: "Dólar" },
	{ pair: "EUR-BRL", label: "Euro" },
	{ pair: "BTC-BRL", label: "Bitcoin" },
] as const;

export type Quote = {
	pair: string;
	/** Rótulo curto. O `name` da API ("Dólar Americano/Real Brasileiro") não cabe. */
	label: string;
	/** Preço de COMPRA (`bid`) — é o que os portais publicam como "a cotação". */
	value: number;
	pctChange: number;
	direction: "up" | "down" | "flat";
	/** Instante da cotação, em ISO com fuso. */
	updatedAt: string | null;
};

/** O que a AwesomeAPI devolve por par. Tudo string, inclusive os números. */
type RawQuote = {
	bid?: unknown;
	pctChange?: unknown;
	create_date?: unknown;
};

/**
 * "USD-BRL" → "USDBRL". A chave do objeto de resposta não tem o hífen que a
 * URL exige — trocar um pelo outro devolve `undefined` em silêncio.
 */
export function payloadKey(pair: string): string {
	return pair.replace("-", "");
}

/**
 * A data da cotação vem como "2021-04-13 08:57:27", **em UTC−3** e sem dizer
 * isso em lugar nenhum da string.
 *
 * `new Date("2021-04-13 08:57:27")` interpreta no fuso de QUEM EXECUTA. No
 * navegador do leitor em Piracuruca dá certo por acidente; no servidor da
 * Vercel, que roda em UTC, dá três horas de erro — e a cotação das 8h57
 * apareceria como 5h57. É o mesmo defeito que já parou o cabeçalho em 3 de
 * agosto e atrasou em um dia a data das páginas legais; aqui o fuso entra
 * explícito.
 *
 * Devolve `null` — e não uma data errada — quando a string não tem o formato
 * esperado: um horário inventado ao lado de um valor real é pior do que
 * horário nenhum.
 */
export function parseQuoteDate(raw: unknown): string | null {
	if (typeof raw !== "string") {
		return null;
	}
	const match = raw
		.trim()
		.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
	if (!match) {
		return null;
	}

	const [, year, month, day, hour, minute, second] = match;
	const date = new Date(
		`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`,
	);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Número a partir do que a API mandou. Recusa o que não vira número finito —
 * `Number("")` é 0 e `Number(null)` é 0, e um zero falso na faixa seria lido
 * como "o dólar vale nada" em vez de "não sabemos".
 */
function toNumber(raw: unknown): number | null {
	if (typeof raw !== "string" && typeof raw !== "number") {
		return null;
	}
	if (typeof raw === "string" && raw.trim() === "") {
		return null;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

/**
 * Zero exato é `flat`, não `up`.
 *
 * Parece detalhe e não é: a direção escolhe a COR e a SETA. Tratar 0 como alta
 * pintaria de verde um dia sem variação — afirmar movimento onde não houve.
 */
export function directionOf(pctChange: number): Quote["direction"] {
	if (pctChange > 0) {
		return "up";
	}
	return pctChange < 0 ? "down" : "flat";
}

/**
 * Extrai as moedas pedidas do payload.
 *
 * Moeda ausente ou com valor ilegível é DESCARTADA, e as outras seguem: um par
 * quebrado no lado da API não pode levar a faixa inteira junto. Quem chama
 * decide o que fazer com uma lista vazia (o portal não renderiza a seção).
 */
export function parseQuotes(
	payload: unknown,
	pairs: ReadonlyArray<{ pair: string; label: string }> = HOME_PAIRS,
): Quote[] {
	if (typeof payload !== "object" || payload === null) {
		return [];
	}
	const source = payload as Record<string, RawQuote | undefined>;

	const quotes: Quote[] = [];
	for (const { pair, label } of pairs) {
		const raw = source[payloadKey(pair)];
		if (!raw) {
			continue;
		}

		const value = toNumber(raw.bid);
		if (value === null || value <= 0) {
			continue;
		}

		// Variação ausente não descarta a moeda: o VALOR é o dado principal, e
		// uma cotação sem variação ainda informa. Sem ela, a seta some.
		const pctChange = toNumber(raw.pctChange) ?? 0;

		quotes.push({
			pair,
			label,
			value,
			pctChange,
			direction: directionOf(pctChange),
			updatedAt: parseQuoteDate(raw.create_date),
		});
	}
	return quotes;
}

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const BRL_PRECISO = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
	minimumFractionDigits: 4,
	maximumFractionDigits: 4,
});

/**
 * Bitcoin passa de R$ 300 mil e o dólar se move na terceira e quarta decimal —
 * o mesmo formato não serve para os dois. Abaixo de mil, quatro casas; acima,
 * as duas de sempre, onde a quarta decimal seria ruído ao lado do milhar.
 */
export function formatValue(value: number): string {
	return value >= 1000 ? BRL.format(value) : BRL_PRECISO.format(value);
}

/** "+0,42%" / "−0,09%" / "0,00%". O sinal é parte da informação. */
export function formatPctChange(pctChange: number): string {
	const formatted = Math.abs(pctChange).toFixed(2).replace(".", ",");
	if (pctChange > 0) {
		return `+${formatted}%`;
	}
	// Sinal de menos tipográfico (U+2212), não hífen: na fonte mono do portal o
	// hífen fica curto demais e some ao lado do dígito.
	return pctChange < 0 ? `−${formatted}%` : `${formatted}%`;
}
