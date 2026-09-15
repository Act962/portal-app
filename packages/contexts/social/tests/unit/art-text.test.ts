import {
	ArtTemplate,
	artFields,
	inputsAfterTextEdit,
	inputsAfterVariableEdit,
	plainTextFor,
	selectionFrom,
	textFor,
	textsFor,
	valuesFor,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	CONTEUDO,
	design,
	texto,
	tituloEditavel,
	variavel,
} from "./art-fixtures";

const chamada = variavel("chamada", "MATÉRIA COMPLETA NOS STORIES", {
	label: "Chamada do botão",
});

describe("textFor (D2, D3)", () => {
	const desenho = design([], [chamada]);

	it("Estático é literal — inclusive as chaves", () => {
		const fixo = texto("fixo", "Use {{titulo}} aqui", { mode: "STATIC" });
		expect(textFor(fixo, desenho, CONTEUDO)).toBe("Use {{titulo}} aqui");
	});

	it("Dinâmico mistura texto fixo e variáveis do sistema e do padrão", () => {
		const caixa = texto("c", "Leia em {{editoria}} · {{chamada}}");
		expect(textFor(caixa, desenho, CONTEUDO)).toBe(
			"Leia em Cidades · MATÉRIA COMPLETA NOS STORIES",
		);
	});

	it("Dinâmico ignora texto trocado no post — só o Editável aceita", () => {
		const caixa = texto("c", "{{titulo}}");
		expect(
			textFor(caixa, desenho, CONTEUDO, {
				values: {},
				texts: { c: "Trocado" },
			}),
		).toBe("Chuva alaga o centro");
	});

	it("caixa-alta em pt-BR e espaços normalizados, mantendo a quebra digitada", () => {
		const caixa = texto("c", "  ação   em {{editoria}} \n  segunda   linha ", {
			style: { ...texto("x").style, uppercase: true },
		});
		expect(textFor(caixa, desenho, CONTEUDO)).toBe(
			"AÇÃO EM CIDADES\nSEGUNDA LINHA",
		);
	});

	it("variável do padrão: o valor do post vence o padrão — mesmo vazio", () => {
		const botao = texto("b", "{{chamada}}");
		expect(
			textFor(botao, desenho, CONTEUDO, {
				values: { chamada: "Leia agora" },
				texts: {},
			}),
		).toBe("Leia agora");
		expect(
			textFor(botao, desenho, CONTEUDO, { values: { chamada: "" }, texts: {} }),
		).toBe("");
	});

	it("Editável: o texto trocado vence, e apagar tudo é legítimo", () => {
		const titulo = tituloEditavel();
		const trocado = { values: {}, texts: { titulo: "Alagamento no centro" } };
		expect(textFor(titulo, desenho, CONTEUDO, trocado)).toBe(
			"Alagamento no centro",
		);
		expect(
			plainTextFor(titulo, desenho, CONTEUDO, {
				values: {},
				texts: { titulo: "" },
			}),
		).toBe("");
	});

	it("textsFor devolve o texto final de cada caixa, por id", () => {
		const desenhoComCaixas = design(
			[texto("chapeu", "{{chapeu}}"), tituloEditavel()],
			[chamada],
		);
		expect(textsFor(desenhoComCaixas, CONTEUDO)).toEqual({
			chapeu: "Últimas",
			titulo: "Chuva alaga o centro",
		});
	});

	it("valuesFor junta sistema e padrão", () => {
		expect(valuesFor(desenho, CONTEUDO)).toMatchObject({
			titulo: "Chuva alaga o centro",
			chamada: "MATÉRIA COMPLETA NOS STORIES",
		});
	});
});

describe("campos do post", () => {
	const naoUsada = variavel("rodape", "Siga @portal7cidades");
	const padrao = ArtTemplate.create({
		id: "tpl",
		name: "Últimas",
		format: "4:5",
		design: design(
			[
				texto("chapeu", "{{chapeu}}"),
				tituloEditavel(),
				texto("botao", "{{chamada}}"),
				texto("fixo", "{{rodape}}", { mode: "STATIC" }),
			],
			[chamada, naoUsada],
		),
		createdAt: new Date("2026-09-14T12:00:00Z"),
	}).unwrap();

	it("mostra as variáveis do padrão EM USO e as caixas Editáveis — nunca as do sistema", () => {
		const campos = artFields(selectionFrom(padrao), CONTEUDO);
		expect(campos.variables).toEqual([
			{
				key: "chamada",
				label: "Chamada do botão",
				multiline: false,
				value: "MATÉRIA COMPLETA NOS STORIES",
				defaultValue: "MATÉRIA COMPLETA NOS STORIES",
				changed: false,
			},
		]);
		expect(campos.texts).toEqual([
			{
				elementId: "titulo",
				label: "Título na arte",
				value: "Chuva alaga o centro",
				original: "Chuva alaga o centro",
				overridden: false,
			},
		]);
	});

	it("com valores próprios, o campo mostra o valor e marca a troca", () => {
		const escolha = selectionFrom(padrao, {
			values: { chamada: "Leia agora" },
			texts: { titulo: "Alagamento" },
		});
		const campos = artFields(escolha, CONTEUDO);
		expect(campos.variables[0]).toMatchObject({
			value: "Leia agora",
			changed: true,
		});
		expect(campos.texts[0]).toMatchObject({
			value: "Alagamento",
			original: "Chuva alaga o centro",
			overridden: true,
		});
	});

	it("voltar ao valor padrão apaga o valor próprio", () => {
		const escolha = selectionFrom(padrao, {
			values: { chamada: "Leia agora" },
		});
		expect(inputsAfterVariableEdit(escolha, "chamada", "Outra").values).toEqual(
			{ chamada: "Outra" },
		);
		expect(
			inputsAfterVariableEdit(
				escolha,
				"chamada",
				"MATÉRIA COMPLETA NOS STORIES",
			).values,
		).toEqual({});
		expect(inputsAfterVariableEdit(escolha, "sumiu", "x").values).toEqual({
			chamada: "Leia agora",
		});
	});

	it("voltar ao texto resolvido apaga a troca; caixa que não é Editável não guarda", () => {
		const escolha = selectionFrom(padrao);
		expect(
			inputsAfterTextEdit(escolha, CONTEUDO, "titulo", "Alagamento").texts,
		).toEqual({ titulo: "Alagamento" });
		expect(
			inputsAfterTextEdit(
				selectionFrom(padrao, { texts: { titulo: "Alagamento" } }),
				CONTEUDO,
				"titulo",
				" Chuva alaga o centro ",
			).texts,
		).toEqual({});
		expect(
			inputsAfterTextEdit(escolha, CONTEUDO, "chapeu", "Plantão").texts,
		).toEqual({});
	});
});
