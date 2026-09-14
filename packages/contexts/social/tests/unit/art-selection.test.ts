import {
	ArtTemplate,
	EMPTY_DESIGN,
	selectionAsTemplate,
	selectionFrom,
	selectionServes,
	withInputs,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	cartao,
	design,
	foto,
	texto,
	tituloEditavel,
	variavel,
} from "./art-fixtures";

const CRIADO = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T13:00:00Z");

const desenho = design(
	[cartao(), tituloEditavel(), texto("botao", "{{chamada}}")],
	[variavel("chamada", "Leia")],
);

function padrao(format: "4:5" | "9:16" = "4:5") {
	return ArtTemplate.create({
		id: "tpl-1",
		name: "Últimas — feed",
		format,
		design: desenho,
		createdAt: CRIADO,
	}).unwrap();
}

describe("selectionFrom (09, D9)", () => {
	it("copia o desenho, a versão e o que a redação preencheu", () => {
		const escolha = selectionFrom(padrao(), {
			values: { chamada: "Leia agora" },
			texts: { titulo: "Outro título" },
		});
		expect(escolha).toEqual({
			templateId: "tpl-1",
			templateName: "Últimas — feed",
			version: 1,
			format: "4:5",
			design: desenho,
			values: { chamada: "Leia agora" },
			texts: { titulo: "Outro título" },
		});
	});

	it("editar o padrão depois NÃO muda a cópia guardada no post", () => {
		const template = padrao();
		const escolha = selectionFrom(template);

		template.update({ design: EMPTY_DESIGN }, DEPOIS);

		expect(template.version).toBe(2);
		expect(escolha.version).toBe(1);
		expect(escolha.design.elements).toHaveLength(3);
	});
});

describe("selectionAsTemplate", () => {
	it("volta a ser um padrão, com a versão da cópia", () => {
		const template = selectionAsTemplate(selectionFrom(padrao()));
		expect(template.id).toBe("tpl-1");
		expect(template.version).toBe(1);
		expect(template.textElements.map((element) => element.id)).toEqual([
			"titulo",
			"botao",
		]);
		expect(template.defaultFor).toEqual([]);
	});

	it("não revalida: um desenho aprovado continua desenhável", () => {
		const antiga = {
			...selectionFrom(padrao()),
			design: design([foto("f1"), foto("f2")]),
		};
		expect(selectionAsTemplate(antiga).elements).toHaveLength(2);
	});
});

describe("selectionServes", () => {
	it("story pede 9:16; feed, 1:1 ou 4:5", () => {
		expect(selectionServes(selectionFrom(padrao()), "INSTAGRAM")).toBe(true);
		expect(selectionServes(selectionFrom(padrao()), "INSTAGRAM_STORIES")).toBe(
			false,
		);
		expect(
			selectionServes(selectionFrom(padrao("9:16")), "INSTAGRAM_STORIES"),
		).toBe(true);
	});
});

describe("withInputs", () => {
	it("guarda só variáveis do padrão e textos de caixas Editáveis", () => {
		const escolha = withInputs(selectionFrom(padrao()), {
			values: { chamada: "Leia agora", titulo: "variável do sistema", x: "?" },
			texts: {
				titulo: "Novo",
				botao: "caixa Dinâmica",
				cartao: "não é texto",
				sumiu: "caixa que não existe mais",
			},
		});
		expect(escolha.values).toEqual({ chamada: "Leia agora" });
		expect(escolha.texts).toEqual({ titulo: "Novo" });
	});
});
