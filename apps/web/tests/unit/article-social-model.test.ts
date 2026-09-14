import { DEFAULT_TEXT_STYLE } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	articleSocialState,
	initialDestinations,
	initialPicks,
	previewSelection,
	templatesInput,
} from "@/app/(app)/dashboard/articles/[id]/article-social-model";

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
	art: { INSTAGRAM: { templateId: "outro" } },
};

describe("initialDestinations", () => {
	it("os destinos do post da matéria, ou o feed do Instagram", () => {
		expect(initialDestinations(postDaMateria)).toEqual([
			"INSTAGRAM",
			"FACEBOOK",
		]);
		expect(initialDestinations(null)).toEqual(["INSTAGRAM"]);
	});
});

describe("initialPicks", () => {
	it("sem post, o padrão de cada destino", () => {
		expect(initialPicks(null, PADROES)).toEqual({
			INSTAGRAM: "feed",
			INSTAGRAM_STORIES: "stories",
			FACEBOOK: null,
		});
	});

	it("com post, o que ELE tem — inclusive 'sem padrão', que alguém escolheu", () => {
		expect(initialPicks(postDaMateria, PADROES)).toEqual({
			INSTAGRAM: "outro",
			INSTAGRAM_STORIES: null,
			FACEBOOK: null,
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

describe("previewSelection", () => {
	it("um padrão da lista vira escolha de arte sem textos trocados", () => {
		const layer = {
			id: "titulo",
			kind: "TEXT" as const,
			box: { x: 0, y: 0, width: 100, height: 50 },
			source: "HEADLINE" as const,
			text: "",
			style: { ...DEFAULT_TEXT_STYLE },
		};
		expect(
			previewSelection({
				id: "feed",
				name: "Últimas — feed",
				version: 3,
				format: "4:5",
				layers: [layer],
			}),
		).toEqual({
			templateId: "feed",
			templateName: "Últimas — feed",
			version: 3,
			format: "4:5",
			layers: [layer],
			overrides: {},
		});
	});
});
