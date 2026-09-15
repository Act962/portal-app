import {
	contentWithHeadline,
	fillTokens,
	formatArtDate,
	SAMPLE_CONTENT,
	SYSTEM_VARIABLE_KEYS,
	systemValues,
	tokensIn,
	VARIABLE_KEY,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import { CONTEUDO } from "./art-fixtures";

describe("tokensIn", () => {
	it("acha as chaves, com espaços dentro das chaves, sem repetir e em ordem", () => {
		expect(tokensIn("{{ chapeu }} · {{titulo}} — {{chapeu}}")).toEqual([
			"chapeu",
			"titulo",
		]);
		expect(tokensIn("sem variável { nenhuma }")).toEqual([]);
	});
});

describe("fillTokens", () => {
	it("troca pelos valores; chave sem valor vira vazio", () => {
		expect(
			fillTokens("Leia em {{editoria}}{{ nada }}!", { editoria: "Cidades" }),
		).toBe("Leia em Cidades!");
	});

	it("não usa o protótipo como valor", () => {
		expect(fillTokens("{{toString}}", {})).toBe("");
	});
});

describe("variáveis do sistema", () => {
	it("mapeiam o conteúdo da matéria, com vazio no que falta", () => {
		expect(systemValues(CONTEUDO)).toEqual({
			titulo: "Chuva alaga o centro",
			subtitulo: "Defesa Civil monitora três bairros",
			chapeu: "Últimas",
			editoria: "Cidades",
			autor: "Redação",
			site: "Portal 7 Cidades",
			data: "14/09/2026",
		});
		expect(systemValues(contentWithHeadline("Bom dia")).chapeu).toBe("");
	});

	it("a data sai no fuso do veículo e some quando é inválida", () => {
		// 01h UTC do dia 15 ainda é dia 14 em Piracuruca.
		expect(formatArtDate("2026-09-15T01:00:00.000Z")).toBe("14/09/2026");
		expect(formatArtDate("ontem")).toBe("");
		expect(formatArtDate(null)).toBe("");
	});

	it("o conteúdo de exemplo preenche todas", () => {
		const valores = systemValues(SAMPLE_CONTENT);
		for (const key of SYSTEM_VARIABLE_KEYS) {
			expect(valores[key as keyof typeof valores]).not.toBe("");
		}
	});

	it("chave válida: minúscula, dígitos e _, começando por letra", () => {
		expect(VARIABLE_KEY.test("chamada_2")).toBe(true);
		expect(VARIABLE_KEY.test("2chamada")).toBe(false);
		expect(VARIABLE_KEY.test("Chamada")).toBe(false);
		expect(VARIABLE_KEY.test("com-hifen")).toBe(false);
	});
});
