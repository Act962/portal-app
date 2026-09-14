import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	estimateLines,
	fitText,
	overflowWarnings,
	type TextLayer,
	textForLayer,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

function caixa(overrides: Partial<TextLayer> = {}, style = {}): TextLayer {
	return {
		id: "titulo",
		kind: "TEXT",
		box: { x: 0, y: 0, width: 820, height: 260 },
		source: "HEADLINE",
		text: "",
		style: { ...DEFAULT_TEXT_STYLE, ...style },
		...overrides,
	};
}

const MATERIA = {
	headline: "Estudantes de Piracuruca são premiados na OBMEP",
	kicker: "Últimas",
	sectionName: "Educação",
};

describe("textForLayer", () => {
	it("cada origem pega o dado certo da matéria", () => {
		expect(textForLayer(caixa(), MATERIA)).toBe(MATERIA.headline);
		expect(textForLayer(caixa({ source: "KICKER" }), MATERIA)).toBe("Últimas");
		expect(textForLayer(caixa({ source: "SECTION" }), MATERIA)).toBe(
			"Educação",
		);
		expect(
			textForLayer(
				caixa({ source: "STATIC", text: "Leia nos stories" }),
				MATERIA,
			),
		).toBe("Leia nos stories");
	});

	it("dado ausente da matéria vira caixa vazia", () => {
		const semChapeu = { ...MATERIA, kicker: null, sectionName: null };
		expect(textForLayer(caixa({ source: "KICKER" }), semChapeu)).toBe("");
		expect(textForLayer(caixa({ source: "SECTION" }), semChapeu)).toBe("");
	});

	it("o texto trocado no post vence — inclusive vazio", () => {
		expect(textForLayer(caixa(), MATERIA, { titulo: "Outro título" })).toBe(
			"Outro título",
		);
		expect(
			textForLayer(caixa({ source: "KICKER", id: "chapeu" }), MATERIA, {
				chapeu: "",
			}),
		).toBe("");
	});

	it("caixa-alta em português, sem perder acento e cedilha", () => {
		expect(
			textForLayer(caixa({}, { uppercase: true }), {
				...MATERIA,
				headline: "avanço da educação no município",
			}),
		).toBe("AVANÇO DA EDUCAÇÃO NO MUNICÍPIO");
	});

	it("junta espaços, mas preserva a quebra de linha digitada", () => {
		expect(
			textForLayer(caixa(), MATERIA, {
				titulo: "  Estudantes   premiados \n  na OBMEP ",
			}),
		).toBe("Estudantes premiados\nna OBMEP");
	});
});

describe("estimateLines", () => {
	it("quebra por palavra", () => {
		// 10 caracteres por linha.
		expect(estimateLines("aaaa bbbb cccc", 100, 10)).toBe(2);
		expect(estimateLines("aaaa bbbbb", 100, 10)).toBe(1);
		expect(estimateLines("aaaa bbbbbb", 100, 10)).toBe(2);
	});

	it("parte palavra maior que a linha", () => {
		expect(estimateLines("a".repeat(25), 100, 10)).toBe(3);
		expect(estimateLines(`oi ${"a".repeat(25)} fim`, 100, 10)).toBe(4);
		expect(estimateLines("a".repeat(20), 100, 10)).toBe(2);
	});

	it("cada quebra digitada abre linha, e linha vazia conta", () => {
		expect(estimateLines("um\ndois", 100, 10)).toBe(2);
		expect(estimateLines("um\n\ndois", 100, 10)).toBe(3);
	});

	it("largura de caractere zero não divide por zero", () => {
		// Sem a guarda, `width / 0` daria Infinity caracteres por linha — ou NaN.
		expect(Number.isFinite(estimateLines("abc", 1, 0))).toBe(true);
		expect(estimateLines("abc", 1, 0)).toBe(1);
	});
});

describe("fitText (D7)", () => {
	it("título curto fica no tamanho cheio", () => {
		expect(fitText("Chuva no centro", caixa())).toEqual({
			fontSize: 64,
			lines: 1,
			fits: true,
		});
	});

	it("título longo encolhe até caber", () => {
		const longo =
			"Estudantes da rede municipal de Piracuruca são premiados na OBMEP e destacam avanço da educação no município";
		const resultado = fitText(
			longo,
			caixa({}, { uppercase: true, maxLines: 4 }),
		);
		expect(resultado.fits).toBe(true);
		expect(resultado.fontSize).toBeLessThan(64);
		expect(resultado.fontSize).toBeGreaterThanOrEqual(32);
		expect(resultado.lines).toBeLessThanOrEqual(4);
	});

	it("o que não cabe nem no mínimo devolve o mínimo, avisando", () => {
		const resultado = fitText("palavra ".repeat(80), caixa());
		expect(resultado).toMatchObject({ fontSize: 32, fits: false });
	});

	it("o mínimo é tentado mesmo quando o passo pula por cima dele", () => {
		// 63 → 61 → … → 33, e então o mínimo 32. Duas linhas a 1,2 de entrelinha
		// medem 79,2 px em 33 e 76,8 px em 32: numa caixa de 78 px, só o mínimo
		// cabe — e ele precisa ser tentado, não pulado.
		const layer = caixa(
			{ box: { x: 0, y: 0, width: 820, height: 78 } },
			{ fontSize: 63, minFontSize: 32, maxLines: 2, lineHeight: 1.2 },
		);
		const texto = "a ".repeat(40).trim();
		expect(fitText(texto, layer)).toMatchObject({ fontSize: 32, fits: true });
	});

	it("o respiro da pílula reduz o espaço útil", () => {
		const semFundo = fitText(
			"ÚLTIMAS NOTÍCIAS",
			caixa({ box: { x: 0, y: 0, width: 400, height: 80 } }),
		);
		const comFundo = fitText(
			"ÚLTIMAS NOTÍCIAS",
			caixa(
				{ box: { x: 0, y: 0, width: 400, height: 80 } },
				{
					background: {
						color: "#ffffff",
						radius: 40,
						paddingX: 60,
						paddingY: 10,
					},
				},
			),
		);
		expect(comFundo.fontSize).toBeLessThan(semFundo.fontSize);
	});

	it("caixa vazia cabe, sem linha", () => {
		expect(fitText("  ", caixa())).toEqual({
			fontSize: 64,
			lines: 0,
			fits: true,
		});
	});

	it("negrito e caixa-alta ocupam mais que o texto leve", () => {
		const texto = "palavra ".repeat(12).trim();
		const leve = fitText(texto, caixa({}, { fontWeight: 400 }));
		const pesado = fitText(
			texto,
			caixa({}, { fontWeight: 900, uppercase: true }),
		);
		expect(pesado.fontSize).toBeLessThanOrEqual(leve.fontSize);
	});
});

describe("overflowWarnings", () => {
	it("avisa o que vai sair cortado, pelo nome da caixa", () => {
		const template = ArtTemplate.create({
			id: "tpl",
			name: "Últimas",
			format: "4:5",
			layers: [
				caixa({ box: { x: 0, y: 0, width: 200, height: 40 } }),
				caixa({ id: "chapeu", source: "KICKER" }),
			],
			createdAt: new Date("2026-09-14T12:00:00Z"),
		}).unwrap();

		expect(
			overflowWarnings(template, {
				...MATERIA,
				headline: "palavra ".repeat(30),
			}),
		).toEqual([
			'O título não cabe no padrão "Últimas" nem no tamanho mínimo e vai sair cortado.',
		]);
		expect(overflowWarnings(template, MATERIA, { titulo: "Curto" })).toEqual(
			[],
		);
	});
});
