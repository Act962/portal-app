import type { ArtDesign } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	affectsSocialPreview,
	articleSocialState,
	contentInput,
	initialDestinations,
	initialInputs,
	initialPicks,
	inputsInput,
	relevantContentFields,
	selectionForPick,
	templatesInput,
} from "@/app/(app)/dashboard/articles/[id]/article-social-model";

describe("relevantContentFields — só os textos da matéria que fazem efeito", () => {
	const caixa = (
		mode: "STATIC" | "DYNAMIC" | "EDITABLE",
		content: string,
		visible = true,
	) => ({ kind: "TEXT", mode, content, visible });
	const desenho = (...elements: object[]) =>
		({
			background: "#000000",
			elements,
			variables: [],
		}) as unknown as ArtDesign;

	it("caixa Editável já é campo próprio; variável sem caixa não aparece", () => {
		// O caso do "Padrão Instagram": chapéu e título em caixas Editáveis.
		expect(
			relevantContentFields([
				desenho(
					caixa("EDITABLE", "{{chapeu}}"),
					caixa("EDITABLE", "{{titulo}}"),
					caixa("STATIC", "MATÉRIA COMPLETA"),
				),
			]),
		).toEqual([]);
	});

	it("caixa Dinâmica visível, de qualquer destino marcado, oferece a variável", () => {
		expect(
			relevantContentFields([
				desenho(caixa("DYNAMIC", "Leia em {{editoria}}")),
				desenho(
					caixa("DYNAMIC", "{{titulo}}"),
					caixa("DYNAMIC", "{{subtitulo}}", false),
					caixa("DYNAMIC", "{{autor}} · {{data}}"),
				),
			]),
		).toEqual(["headline", "sectionName"]);
	});
});

const PADROES = {
	INSTAGRAM: { id: "feed", name: "Últimas — feed" },
	INSTAGRAM_STORIES: { id: "stories", name: "Stories" },
	FACEBOOK: null,
} as const;

const postDaMateria = {
	status: "RASCUNHO" as const,
	deliveries: [
		{ destination: "INSTAGRAM" as const },
		{ destination: "FACEBOOK" as const },
	],
	art: {
		INSTAGRAM: {
			templateId: "outro",
			values: { chamada: "LEIA" },
			texts: { titulo: "Trocado" },
		},
	},
};

describe("initialDestinations", () => {
	it("os destinos do post que o cartão oferece — sem o Facebook —, ou o feed do Instagram", () => {
		expect(initialDestinations(postDaMateria)).toEqual(["INSTAGRAM"]);
		expect(initialDestinations(null)).toEqual(["INSTAGRAM"]);
	});
});

describe("campos da arte e textos", () => {
	it("os campos vêm do post, só dos destinos com arte", () => {
		expect(initialInputs(postDaMateria)).toEqual({
			INSTAGRAM: { values: { chamada: "LEIA" }, texts: { titulo: "Trocado" } },
		});
		expect(initialInputs(null)).toEqual({});
	});

	it("envia campos só de destino marcado e com padrão", () => {
		const campos = { values: {}, texts: { titulo: "x" } };
		expect(
			inputsInput(
				["INSTAGRAM", "INSTAGRAM_STORIES"],
				{ INSTAGRAM: "feed", INSTAGRAM_STORIES: null },
				{ INSTAGRAM: campos, INSTAGRAM_STORIES: campos, FACEBOOK: campos },
			),
		).toEqual({ INSTAGRAM: campos });
	});

	it("a escolha para a prévia leva o padrão e os campos", () => {
		const padrao = {
			id: "feed",
			name: "Últimas",
			version: 3,
			format: "4:5" as const,
			design: { background: "#000000", elements: [], variables: [] },
		};
		expect(selectionForPick(padrao, undefined)).toMatchObject({
			templateId: "feed",
			templateName: "Últimas",
			version: 3,
			values: {},
			texts: {},
		});
	});

	it("campo opcional apagado vai como sem valor", () => {
		expect(
			contentInput({
				headline: "Título",
				subtitle: "  ",
				kicker: "",
				sectionName: "Educação",
				authorName: null,
				siteName: null,
				date: null,
			}),
		).toMatchObject({ subtitle: null, kicker: null, sectionName: "Educação" });
	});
});

describe("affectsSocialPreview — quando o cartão refaz a consulta", () => {
	const materia = {
		headline: "Título",
		kicker: "Últimas",
		standfirst: "Linha fina",
		sectionId: "s-1",
		cover: { mediaId: "capa-1" },
	};

	it("trocar a capa ou os textos da arte refaz; o resto não", () => {
		expect(
			affectsSocialPreview(materia, {
				...materia,
				cover: { mediaId: "capa-2" },
			}),
		).toBe(true);
		expect(affectsSocialPreview(materia, { ...materia, cover: null })).toBe(
			true,
		);
		expect(
			affectsSocialPreview(materia, { ...materia, headline: "Outro" }),
		).toBe(true);
		expect(affectsSocialPreview(materia, { ...materia })).toBe(false);
		expect(affectsSocialPreview(undefined, materia)).toBe(true);
	});
});

describe("initialPicks", () => {
	it("sem post, o padrão de cada destino", () => {
		expect(initialPicks(null, PADROES)).toEqual({
			INSTAGRAM: "feed",
			INSTAGRAM_STORIES: "stories",
		});
	});

	it("com post, o que ELE tem — inclusive 'sem padrão', que alguém escolheu", () => {
		expect(initialPicks(postDaMateria, PADROES)).toEqual({
			INSTAGRAM: "outro",
			INSTAGRAM_STORIES: null,
		});
	});
});

describe("templatesInput", () => {
	it("só os destinos marcados, com 'sem padrão' como null explícito", () => {
		expect(
			templatesInput(["INSTAGRAM", "FACEBOOK"], {
				INSTAGRAM: "feed",
				INSTAGRAM_STORIES: "stories",
			}),
		).toEqual({ INSTAGRAM: "feed", FACEBOOK: null });
	});
});

describe("articleSocialState", () => {
	it("matéria no ar e sem post: edita e aprova", () => {
		expect(articleSocialState(true, null)).toEqual({
			editable: true,
			canApprove: true,
			hint: null,
		});
	});

	it("matéria fora do ar: rascunho sim, aprovar não — dizendo por quê", () => {
		const estado = articleSocialState(false, null);
		expect(estado.editable).toBe(true);
		expect(estado.canApprove).toBe(false);
		expect(estado.hint).toContain("Publique a matéria");
	});

	it("post já aprovado: nada a mexer, e a fila é o lugar de acompanhar", () => {
		for (const status of ["PUBLICANDO", "PUBLICADO", "PARCIAL"] as const) {
			const estado = articleSocialState(true, { status });
			expect(estado).toMatchObject({ editable: false, canApprove: false });
			expect(estado.hint).toContain("fila");
		}
	});

	it("rascunho existente com a matéria no ar: edita e aprova", () => {
		expect(articleSocialState(true, { status: "RASCUNHO" })).toMatchObject({
			editable: true,
			canApprove: true,
		});
	});
});
