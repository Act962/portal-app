import { describe, expect, it } from "vitest";

import {
	directionOf,
	formatPctChange,
	formatValue,
	parseQuoteDate,
	parseQuotes,
	payloadKey,
} from "@/lib/quotes";

/** Uma resposta da AwesomeAPI como ela realmente chega: tudo string. */
const PAYLOAD = {
	USDBRL: {
		code: "USD",
		codein: "BRL",
		name: "Dólar Americano/Real Brasileiro",
		high: "5.734",
		low: "5.7279",
		varBid: "-0.0054",
		pctChange: "-0.09",
		bid: "5.7276",
		ask: "5.7282",
		timestamp: "1618315045",
		create_date: "2021-04-13 08:57:27",
	},
	EURBRL: {
		bid: "6.8321",
		pctChange: "0.42",
		create_date: "2021-04-13 08:57:27",
	},
	BTCBRL: {
		bid: "350123.45",
		pctChange: "0",
		create_date: "2021-04-13 08:57:27",
	},
};

describe("payloadKey", () => {
	it("tira o hífen — a chave do JSON não tem o que a URL exige", () => {
		// Trocar um pelo outro devolve `undefined` em silêncio, e a moeda
		// simplesmente não aparece sem nenhum erro.
		expect(payloadKey("USD-BRL")).toBe("USDBRL");
	});
});

describe("parseQuotes", () => {
	it("lê as três moedas da home", () => {
		const quotes = parseQuotes(PAYLOAD);

		expect(quotes.map((q) => q.pair)).toEqual([
			"USD-BRL",
			"EUR-BRL",
			"BTC-BRL",
		]);
		expect(quotes[0]?.label).toBe("Dólar");
	});

	it("converte string para número — a API manda tudo como texto", () => {
		const [dolar] = parseQuotes(PAYLOAD);

		expect(dolar?.value).toBe(5.7276);
		expect(dolar?.pctChange).toBe(-0.09);
	});

	it("usa o `bid` (compra), que é o que os portais publicam", () => {
		// `ask` é 5.7282 no payload; se o dia em que alguém trocar, este teste
		// diz que a mudança é de PRODUTO, não um detalhe de implementação.
		expect(parseQuotes(PAYLOAD)[0]?.value).toBe(5.7276);
	});

	it("descarta a moeda quebrada e mantém as outras", () => {
		// Um par ruim no lado da API não pode levar a faixa inteira junto.
		const quotes = parseQuotes({ ...PAYLOAD, USDBRL: { bid: "abacaxi" } });

		expect(quotes.map((q) => q.pair)).toEqual(["EUR-BRL", "BTC-BRL"]);
	});

	it.each([
		["ausente", {}],
		["vazio", { bid: "" }],
		["nulo", { bid: null }],
		["zero", { bid: "0" }],
		["negativo", { bid: "-1" }],
	])("descarta cotação com valor %s", (_caso, raw) => {
		// `Number("")` e `Number(null)` são 0. Um zero falso na faixa seria lido
		// como "o dólar vale nada" em vez de "não sabemos".
		expect(
			parseQuotes({ USDBRL: raw }, [{ pair: "USD-BRL", label: "Dólar" }]),
		).toEqual([]);
	});

	it("variação ausente não descarta a moeda — o valor é o dado principal", () => {
		const quotes = parseQuotes({ USDBRL: { bid: "5.7276" } }, [
			{ pair: "USD-BRL", label: "Dólar" },
		]);

		expect(quotes[0]?.value).toBe(5.7276);
		expect(quotes[0]?.pctChange).toBe(0);
		expect(quotes[0]?.direction).toBe("flat");
	});

	it("moeda que não veio na resposta simplesmente não entra", () => {
		expect(parseQuotes({ USDBRL: PAYLOAD.USDBRL }).map((q) => q.pair)).toEqual([
			"USD-BRL",
		]);
	});

	it.each([
		["null", null],
		["texto", "erro 500"],
		["lista", []],
	])("devolve lista vazia para payload %s, sem estourar", (_caso, payload) => {
		// O portal não pode cair porque a API respondeu outra coisa.
		expect(parseQuotes(payload)).toEqual([]);
	});
});

describe("directionOf", () => {
	it("zero exato é flat, NÃO alta", () => {
		// A direção escolhe a cor e a seta. Tratar 0 como alta pintaria de verde
		// um dia sem variação — afirmar movimento onde não houve.
		expect(directionOf(0)).toBe("flat");
		expect(directionOf(0.01)).toBe("up");
		expect(directionOf(-0.01)).toBe("down");
	});
});

describe("parseQuoteDate", () => {
	it("interpreta a data como UTC−3, que é o fuso da API", () => {
		// A string não diz o fuso em lugar nenhum, e o `new Date` cru usa o de
		// QUEM EXECUTA: no servidor da Vercel, que roda em UTC, dariam 3 horas de
		// erro. É o mesmo defeito que já parou o cabeçalho em 3 de agosto.
		expect(parseQuoteDate("2021-04-13 08:57:27")).toBe(
			"2021-04-13T11:57:27.000Z",
		);
	});

	it.each([
		["formato inesperado", "13/04/2021 08:57"],
		["texto solto", "agora"],
		["vazio", ""],
		["não string", 1618315045],
		["nulo", null],
	])("devolve null para %s, em vez de uma data inventada", (_caso, raw) => {
		// Horário errado ao lado de um valor real é pior do que horário nenhum.
		expect(parseQuoteDate(raw)).toBeNull();
	});
});

describe("formatValue", () => {
	/**
	 * O `Intl` põe um espaço NÃO SEPARÁVEL (U+00A0) entre "R$" e o número, e
	 * isso é desejável: impede que o símbolo quebre linha sozinho, longe do
	 * valor. Escrito aqui como escape porque um NBSP literal no código-fonte é
	 * invisível — e a próxima pessoa a ver este teste falhar por um caractere
	 * que não enxerga tende a "corrigir" normalizando a saída, que é justamente
	 * o que não se quer.
	 */
	const NBSP = "\u00A0";

	it("abaixo de mil, quatro casas — o dólar se move na terceira decimal", () => {
		expect(formatValue(5.7276)).toBe(`R$${NBSP}5,7276`);
	});

	it("acima de mil, duas casas e separador de milhar", () => {
		// Quarta decimal ao lado do milhar do Bitcoin é ruído.
		expect(formatValue(350123.45)).toBe(`R$${NBSP}350.123,45`);
	});
});

describe("formatPctChange", () => {
	it("mantém o sinal, que é parte da informação", () => {
		expect(formatPctChange(0.42)).toBe("+0,42%");
		expect(formatPctChange(0)).toBe("0,00%");
	});

	it("usa o sinal de menos tipográfico, não o hífen", () => {
		// Na fonte mono do portal o hífen fica curto demais e some ao lado do
		// dígito.
		expect(formatPctChange(-0.09)).toBe("−0,09%");
	});
});

/**
 * Esqueleto aberto — entrega sem teste deixa o registro EXECUTÁVEL do que falta
 * (regra 2 do CLAUDE.md). O `quoteDirection` nasceu ao subir as cotações para o
 * cabeçalho: a faixa da home e a tira do topo passaram a compartilhar o mapa,
 * mas com cores diferentes, porque uma vive sobre o marrom e a outra sobre o
 * branco. É exatamente aí que mora o erro provável.
 */
describe("quoteDirection", () => {
	it.todo("devolve a leitura por extenso, que é o que o leitor de tela recebe");
	it.todo("usa as cores claras sobre o escuro e as `-ink` sobre o claro");
	it.todo("estável não é alta: zero exato tem seta e leitura próprias");
});
