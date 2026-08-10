import { describe, expect, it } from "vitest";

import {
	DEFAULT_PAGE_SIZE,
	MAX_PAGE_SIZE,
	pageCount,
	toPageRequest,
} from "../../src/index";

describe("toPageRequest", () => {
	it("sem entrada, devolve a primeira página no tamanho padrão", () => {
		expect(toPageRequest()).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
		expect(toPageRequest({})).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
	});

	// O clássico desta função. A UI e a URL contam a partir de 1; o banco, de 0.
	it("converte página 1-based em offset 0-based", () => {
		expect(toPageRequest({ page: 1, perPage: 20 }).offset).toBe(0);
		expect(toPageRequest({ page: 2, perPage: 20 }).offset).toBe(20);
		expect(toPageRequest({ page: 7, perPage: 15 }).offset).toBe(90);
	});

	// `perPage` chega pela rede. Sem teto, `?perPage=1000000` vira um pedido de
	// despejo do banco inteiro para qualquer pessoa autenticada.
	it("limita o tamanho da página ao teto", () => {
		expect(toPageRequest({ perPage: 1_000_000 }).limit).toBe(MAX_PAGE_SIZE);
		expect(toPageRequest({ perPage: MAX_PAGE_SIZE + 1 }).limit).toBe(
			MAX_PAGE_SIZE,
		);
	});

	it("recusa tamanho de página menor que 1", () => {
		expect(toPageRequest({ perPage: 0 }).limit).toBe(1);
		expect(toPageRequest({ perPage: -30 }).limit).toBe(1);
	});

	it("página menor que 1 vira a primeira", () => {
		expect(toPageRequest({ page: 0 }).offset).toBe(0);
		expect(toPageRequest({ page: -5 }).offset).toBe(0);
	});

	// Vindo de `Number(searchParams.get("page"))`, lixo vira NaN — e `NaN * 20`
	// contamina o offset em silêncio, devolvendo lista vazia sem explicação.
	it.each([Number.NaN, Number.POSITIVE_INFINITY, 2.5])(
		"valor não inteiro cai no padrão: %s",
		(value) => {
			expect(toPageRequest({ page: value, perPage: value })).toEqual({
				limit: DEFAULT_PAGE_SIZE,
				offset: 0,
			});
		},
	);

	it("aceita uma página muito além do fim — a lista volta vazia, e tudo bem", () => {
		expect(toPageRequest({ page: 9999, perPage: 10 }).offset).toBe(99_980);
	});
});

describe("pageCount", () => {
	it("conta as páginas necessárias", () => {
		expect(pageCount(100, 20)).toBe(5);
		expect(pageCount(101, 20)).toBe(6);
		expect(pageCount(19, 20)).toBe(1);
	});

	// Lista vazia continua sendo "página 1 de 1" — a UI não deve mostrar "de 0".
	it("sem itens, ainda é uma página", () => {
		expect(pageCount(0, 20)).toBe(1);
	});

	it("não divide por zero", () => {
		expect(pageCount(50, 0)).toBe(1);
	});
});
