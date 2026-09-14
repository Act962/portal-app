import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	selectionAsTemplate,
	selectionFrom,
	selectionServes,
	type TemplateLayer,
	withOverrides,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const CRIADO = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T13:00:00Z");

const cartao: TemplateLayer = {
	id: "cartao",
	kind: "SHAPE",
	box: { x: 80, y: 430, width: 920, height: 520 },
	color: "#d9232e",
	radius: 48,
	opacity: 1,
};
const titulo: TemplateLayer = {
	id: "titulo",
	kind: "TEXT",
	box: { x: 130, y: 560, width: 820, height: 240 },
	source: "HEADLINE",
	text: "",
	style: { ...DEFAULT_TEXT_STYLE },
};

function padrao(format: "4:5" | "9:16" = "4:5") {
	return ArtTemplate.create({
		id: "tpl-1",
		name: "Últimas — feed",
		format,
		layers: [cartao, titulo],
		createdAt: CRIADO,
	}).unwrap();
}

describe("selectionFrom (D9)", () => {
	it("copia o desenho, a versão e os textos trocados", () => {
		const escolha = selectionFrom(padrao(), { titulo: "Outro título" });
		expect(escolha).toEqual({
			templateId: "tpl-1",
			templateName: "Últimas — feed",
			version: 1,
			format: "4:5",
			layers: [cartao, titulo],
			overrides: { titulo: "Outro título" },
		});
	});

	it("editar o padrão depois NÃO muda a cópia guardada no post", () => {
		const template = padrao();
		const escolha = selectionFrom(template);

		template.update({ layers: [cartao] }, DEPOIS);

		expect(template.version).toBe(2);
		expect(escolha.version).toBe(1);
		expect(escolha.layers).toEqual([cartao, titulo]);
	});
});

describe("selectionAsTemplate", () => {
	it("volta a ser um padrão para o desenhista, com a versão da cópia", () => {
		const template = selectionAsTemplate(selectionFrom(padrao()));
		expect(template.id).toBe("tpl-1");
		expect(template.version).toBe(1);
		expect(template.textLayers.map((layer) => layer.id)).toEqual(["titulo"]);
		expect(template.defaultFor).toEqual([]);
	});

	it("não revalida: um desenho aprovado continua desenhável", () => {
		// Duas fotos seria recusado hoje; uma cópia antiga assim ainda desenha.
		const antiga = {
			...selectionFrom(padrao()),
			layers: [
				{ id: "f1", kind: "PHOTO", box: cartao.box },
				{ id: "f2", kind: "PHOTO", box: cartao.box },
			] as TemplateLayer[],
		};
		expect(selectionAsTemplate(antiga).layers).toHaveLength(2);
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

describe("withOverrides", () => {
	it("guarda só os textos das caixas que o desenho tem", () => {
		const escolha = withOverrides(selectionFrom(padrao()), {
			titulo: "Novo",
			cartao: "não é texto",
			sumiu: "caixa que não existe mais",
		});
		expect(escolha.overrides).toEqual({ titulo: "Novo" });
	});
});
