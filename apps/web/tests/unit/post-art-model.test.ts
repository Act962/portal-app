import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	selectionFrom,
	type TemplateLayer,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	artPreviewInput,
	artTextFields,
	overridesAfterEdit,
	type TemplateChoice,
	templatesFor,
} from "@/app/(app)/dashboard/social/post-art-model";

const CONTEUDO = {
	headline: "Estudantes premiados na OBMEP",
	kicker: "Últimas",
	sectionName: null,
};

const titulo: TemplateLayer = {
	id: "titulo",
	kind: "TEXT",
	box: { x: 130, y: 560, width: 820, height: 240 },
	source: "HEADLINE",
	text: "",
	style: { ...DEFAULT_TEXT_STYLE, uppercase: true },
};
const chapeu: TemplateLayer = {
	...titulo,
	id: "chapeu",
	source: "KICKER",
};
const chamada: TemplateLayer = {
	...titulo,
	id: "chamada",
	source: "STATIC",
	text: "Matéria completa nos stories",
};
const cartao: TemplateLayer = {
	id: "cartao",
	kind: "SHAPE",
	box: { x: 80, y: 430, width: 920, height: 520 },
	color: "#d9232e",
	radius: 48,
	opacity: 1,
};

function escolha(overrides = {}) {
	return selectionFrom(
		ArtTemplate.create({
			id: "tpl-1",
			name: "Últimas — feed",
			format: "4:5",
			layers: [cartao, chapeu, titulo, chamada],
			createdAt: new Date("2026-09-14T12:00:00Z"),
		}).unwrap(),
		overrides,
	);
}

describe("templatesFor", () => {
	const padroes: TemplateChoice[] = [
		{
			id: "b",
			name: "Plantão",
			format: "4:5",
			archived: false,
			defaultFor: [],
		},
		{
			id: "a",
			name: "Últimas",
			format: "4:5",
			archived: false,
			defaultFor: ["INSTAGRAM"],
		},
		{
			id: "s",
			name: "Stories",
			format: "9:16",
			archived: false,
			defaultFor: [],
		},
		{ id: "x", name: "Antigo", format: "4:5", archived: true, defaultFor: [] },
	];

	it("só os que servem ao destino e estão ativos, com o padrão do destino primeiro", () => {
		expect(templatesFor("INSTAGRAM", padroes).map((t) => t.id)).toEqual([
			"a",
			"b",
		]);
		expect(templatesFor("FACEBOOK", padroes).map((t) => t.id)).toEqual([
			"b",
			"a",
		]);
		expect(templatesFor("INSTAGRAM_STORIES", padroes).map((t) => t.id)).toEqual(
			["s"],
		);
	});
});

describe("artTextFields", () => {
	it("um campo por caixa de texto, na ordem, sem a caixa-alta do padrão", () => {
		const campos = artTextFields(escolha(), CONTEUDO);
		expect(campos.map((c) => [c.layerId, c.label, c.value])).toEqual([
			["chapeu", "Chapéu na arte", "Últimas"],
			["titulo", "Título na arte", "Estudantes premiados na OBMEP"],
			["chamada", "Texto fixo", "Matéria completa nos stories"],
		]);
		expect(campos.every((c) => !c.overridden)).toBe(true);
	});

	it("o texto trocado aparece no campo, e o original fica guardado", () => {
		const [, campoTitulo] = artTextFields(
			escolha({ titulo: "Título da arte" }),
			CONTEUDO,
		);
		expect(campoTitulo).toMatchObject({
			value: "Título da arte",
			original: "Estudantes premiados na OBMEP",
			overridden: true,
		});
	});
});

describe("overridesAfterEdit", () => {
	it("guarda o texto trocado", () => {
		expect(
			overridesAfterEdit(escolha(), CONTEUDO, "titulo", "Novo título"),
		).toEqual({ titulo: "Novo título" });
	});

	it("voltar ao texto da matéria APAGA a troca — o post volta a seguir a matéria", () => {
		const atual = escolha({ titulo: "Novo título", chapeu: "Plantão" });
		expect(
			overridesAfterEdit(
				atual,
				CONTEUDO,
				"titulo",
				" Estudantes premiados na OBMEP ",
			),
		).toEqual({ chapeu: "Plantão" });
	});

	it("caixa que não existe no desenho não vira troca", () => {
		expect(overridesAfterEdit(escolha(), CONTEUDO, "sumiu", "x")).toEqual({});
	});
});

describe("artPreviewInput", () => {
	it("monta a prévia com a cópia do padrão, o conteúdo, os textos e a foto", () => {
		const entrada = artPreviewInput({
			selection: escolha({ titulo: "Trocado" }),
			content: CONTEUDO,
			photoMediaId: "m-1",
		});
		expect(entrada).toMatchObject({
			name: "Últimas — feed",
			format: "4:5",
			content: CONTEUDO,
			overrides: { titulo: "Trocado" },
			photoMediaId: "m-1",
			width: 360,
		});
		expect(entrada.layers).toHaveLength(4);
	});
});
