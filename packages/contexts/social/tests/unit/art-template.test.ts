import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	fontSupports,
	formatServes,
	isTemplateFontFamily,
	MAX_LAYERS,
	type TemplateLayer,
	type TextLayer,
	templateProblems,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const CRIADO = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T13:00:00Z");

const foto: TemplateLayer = {
	id: "foto",
	kind: "PHOTO",
	box: { x: 0, y: 0, width: 1080, height: 1350 },
};
const moldura: TemplateLayer = {
	id: "moldura",
	kind: "IMAGE",
	box: { x: 0, y: 0, width: 1080, height: 1350 },
	mediaId: "media-moldura",
	fit: "cover",
};
const faixa: TemplateLayer = {
	id: "faixa",
	kind: "SHAPE",
	box: { x: 80, y: 430, width: 920, height: 520 },
	color: "#d9232e",
	radius: 48,
	opacity: 1,
};

function texto(overrides: Partial<TextLayer> = {}): TextLayer {
	return {
		id: "titulo",
		kind: "TEXT",
		box: { x: 130, y: 560, width: 820, height: 220 },
		source: "HEADLINE",
		text: "",
		style: { ...DEFAULT_TEXT_STYLE },
		...overrides,
	};
}

function padrao(layers: readonly TemplateLayer[] = [foto, moldura, texto()]) {
	return ArtTemplate.create({
		id: "tpl-1",
		name: "Últimas — feed",
		format: "4:5",
		layers,
		createdAt: CRIADO,
	});
}

const problemasDe = (
	layers: readonly TemplateLayer[],
	format = "4:5" as const,
) => templateProblems({ name: "P", format, layers, defaultFor: [] });

describe("ArtTemplate.create", () => {
	it("nasce na versão 1, com o quadro do formato", () => {
		const template = padrao().unwrap();
		expect(template.version).toBe(1);
		expect(template.canvas).toEqual({ width: 1080, height: 1350 });
		expect(template.archived).toBe(false);
		expect(template.name).toBe("Últimas — feed");
		expect(template.createdAt).toEqual(CRIADO);
	});

	it("expõe a foto, os textos e as mídias que o desenho usa", () => {
		const template = padrao([foto, faixa, moldura, texto()]).unwrap();
		expect(template.photoLayer?.id).toBe("foto");
		expect(template.textLayers.map((layer) => layer.id)).toEqual(["titulo"]);
		expect(template.mediaIds).toEqual(["media-moldura"]);
		expect(template.layers).toHaveLength(4);
	});

	it("padrão sem foto é válido — arte só de texto existe", () => {
		const template = padrao([faixa, texto()]).unwrap();
		expect(template.photoLayer).toBeNull();
	});

	it("recusa com a lista de problemas, não com um 'inválido'", () => {
		const erro = ArtTemplate.create({
			id: "x",
			name: "  ",
			format: "4:5",
			layers: [foto, { ...foto, id: "outra-foto" }],
			createdAt: CRIADO,
		}).unwrapErr();
		expect(erro.name).toBe("InvalidArtTemplate");
		expect(erro.problems).toEqual([
			"Dê um nome ao padrão.",
			"O padrão só pode ter uma camada de foto.",
		]);
		expect(erro.message).toBe("Dê um nome ao padrão.");
	});
});

describe("templateProblems — o que o editor mostra ao lado da camada", () => {
	it("padrão bom não tem problema", () => {
		expect(problemasDe([foto, faixa, moldura, texto()])).toEqual([]);
	});

	it("nome longo demais e formato desconhecido", () => {
		expect(
			templateProblems({
				name: "a".repeat(61),
				format: "4:5",
				layers: [],
				defaultFor: [],
			}),
		).toEqual(["O nome do padrão passa de 60 caracteres."]);
		expect(
			templateProblems({
				name: "P",
				format: "16:9" as never,
				layers: [],
				defaultFor: [],
			}),
		).toEqual(["Formato desconhecido: 16:9."]);
	});

	it("ids vazios e repetidos", () => {
		expect(problemasDe([{ ...foto, id: " " }])).toEqual([
			"Camada 1: falta o identificador.",
		]);
		expect(problemasDe([faixa, { ...faixa }])).toEqual([
			"Camada 2: identificador repetido (faixa).",
		]);
	});

	it("caixa pode sangrar para fora, mas não pode estar inteira fora", () => {
		expect(
			problemasDe([
				{ ...foto, box: { x: -100, y: -100, width: 1300, height: 1600 } },
			]),
		).toEqual([]);
		expect(
			problemasDe([
				{ ...foto, box: { x: 1080, y: 0, width: 100, height: 100 } },
			]),
		).toEqual(["Camada 1: a caixa está toda fora do quadro."]);
		expect(
			problemasDe([{ ...foto, box: { x: 0, y: 0, width: 0, height: 100 } }]),
		).toEqual(["Camada 1: a caixa precisa ter largura e altura."]);
		expect(
			problemasDe([
				{ ...foto, box: { x: Number.NaN, y: 0, width: 10, height: 10 } },
			]),
		).toEqual(["Camada 1: posição ou tamanho inválido."]);
	});

	it("o limite de 1350 vale no 4:5, mas não no 9:16", () => {
		const embaixo: TemplateLayer = {
			...faixa,
			box: { x: 0, y: 1500, width: 100, height: 100 },
		};
		expect(problemasDe([embaixo])).toHaveLength(1);
		expect(problemasDe([embaixo], "9:16" as never)).toEqual([]);
	});

	it("imagem sem mídia e forma com cor, opacidade ou raio inválidos", () => {
		expect(problemasDe([{ ...moldura, mediaId: "" }])).toEqual([
			"Camada 1: escolha a imagem da biblioteca.",
		]);
		expect(
			problemasDe([{ ...faixa, color: "vermelho", opacity: 2, radius: -1 }]),
		).toEqual([
			"Camada 1: cor inválida (vermelho).",
			"Camada 1: a opacidade vai de 0 a 1.",
			"Camada 1: o arredondamento não pode ser negativo.",
		]);
	});

	it("aceita cor com transparência (#rrggbbaa)", () => {
		expect(problemasDe([{ ...faixa, color: "#00000080" }])).toEqual([]);
	});

	it("texto fixo precisa de texto, e nenhum texto passa de 300 caracteres", () => {
		expect(problemasDe([texto({ source: "STATIC", text: " " })])).toEqual([
			"Camada 1: escreva o texto fixo.",
		]);
		expect(problemasDe([texto({ text: "a".repeat(301) })])).toEqual([
			"Camada 1: o texto passa de 300 caracteres.",
		]);
		expect(problemasDe([texto({ source: "OUTRA" as never })])).toEqual([
			"Camada 1: origem do texto desconhecida.",
		]);
	});

	it("só oferece o que o renderizador sabe desenhar", () => {
		expect(
			problemasDe([
				texto({
					style: { ...DEFAULT_TEXT_STYLE, fontFamily: "Comic Sans" as never },
				}),
			]),
		).toEqual(["Camada 1: a fonte Comic Sans não está disponível."]);
		expect(
			problemasDe([
				texto({
					style: {
						...DEFAULT_TEXT_STYLE,
						fontFamily: "Oswald",
						fontWeight: 700,
						italic: true,
					},
				}),
			]),
		).toEqual(["Camada 1: a Oswald não tem itálico no peso 700."]);
		expect(
			problemasDe([
				texto({
					style: {
						...DEFAULT_TEXT_STYLE,
						fontFamily: "Oswald",
						fontWeight: 900,
					},
				}),
			]),
		).toEqual(["Camada 1: a Oswald não tem no peso 900."]);
	});

	it("medidas do texto fora da faixa", () => {
		const problemas = problemasDe([
			texto({
				style: {
					...DEFAULT_TEXT_STYLE,
					fontSize: 500,
					minFontSize: 600,
					lineHeight: 3,
					maxLines: 0,
					color: "#fff",
				},
			}),
		]);
		expect(problemas).toEqual([
			"Camada 1: o tamanho da fonte vai de 8 a 400.",
			"Camada 1: o tamanho mínimo vai de 8 até o tamanho da fonte.",
			"Camada 1: a entrelinha vai de 0,8 a 2.",
			"Camada 1: o máximo de linhas vai de 1 a 12.",
			"Camada 1: cor do texto inválida (#fff).",
		]);
		expect(
			problemasDe([texto({ style: { ...DEFAULT_TEXT_STYLE, maxLines: 13 } })]),
		).toEqual(["Camada 1: o máximo de linhas vai de 1 a 12."]);
	});

	it("fundo do texto (a pílula) com cor ou medidas inválidas", () => {
		expect(
			problemasDe([
				texto({
					style: {
						...DEFAULT_TEXT_STYLE,
						background: {
							color: "branco",
							radius: -1,
							paddingX: 10,
							paddingY: 4,
						},
					},
				}),
			]),
		).toEqual([
			"Camada 1: cor do fundo inválida (branco).",
			"Camada 1: arredondamento e respiro do fundo não podem ser negativos.",
		]);
	});

	it(`no máximo ${MAX_LAYERS} camadas`, () => {
		const muitas = Array.from({ length: MAX_LAYERS + 1 }, (_, index) => ({
			...faixa,
			id: `f-${index}`,
		}));
		expect(problemasDe(muitas)).toEqual([
			`Um padrão aceita até ${MAX_LAYERS} camadas.`,
		]);
	});
});

describe("padrão de destino (D10)", () => {
	it("o formato precisa servir ao destino", () => {
		expect(formatServes("9:16", "INSTAGRAM_STORIES")).toBe(true);
		expect(formatServes("4:5", "INSTAGRAM_STORIES")).toBe(false);
		expect(formatServes("4:5", "INSTAGRAM")).toBe(true);
		expect(formatServes("1:1", "FACEBOOK")).toBe(true);
		expect(formatServes("9:16", "INSTAGRAM")).toBe(false);
	});

	it("recusa um 4:5 como padrão dos Stories", () => {
		const erro = ArtTemplate.create({
			id: "x",
			name: "Feed",
			format: "4:5",
			defaultFor: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			createdAt: CRIADO,
		}).unwrapErr();
		expect(erro.problems).toEqual([
			"Um padrão 4:5 não pode ser o padrão de Stories do Instagram.",
		]);
	});

	it("marcar como padrão não muda a versão — não mexe no desenho", () => {
		const template = padrao().unwrap();
		expect(
			template.setDefaultFor(["INSTAGRAM", "INSTAGRAM"], DEPOIS).isOk(),
		).toBe(true);
		expect(template.defaultFor).toEqual(["INSTAGRAM"]);
		expect(template.isDefaultFor("INSTAGRAM")).toBe(true);
		expect(template.isDefaultFor("FACEBOOK")).toBe(false);
		expect(template.version).toBe(1);
		expect(template.updatedAt).toEqual(DEPOIS);
	});

	it("setDefaultFor incompatível não muda nada", () => {
		const template = padrao().unwrap();
		expect(
			template.setDefaultFor(["INSTAGRAM_STORIES"], DEPOIS).unwrapErr().name,
		).toBe("InvalidArtTemplate");
		expect(template.defaultFor).toEqual([]);
	});
});

describe("update — o desenho muda, a versão sobe (D9)", () => {
	it("sobe a versão e a data", () => {
		const template = padrao().unwrap();
		expect(
			template.update({ name: " Novo ", layers: [foto] }, DEPOIS).isOk(),
		).toBe(true);
		expect(template.version).toBe(2);
		expect(template.name).toBe("Novo");
		expect(template.layers).toEqual([foto]);
		expect(template.updatedAt).toEqual(DEPOIS);
	});

	it("tudo ou nada: com problema, nada muda", () => {
		const template = padrao().unwrap();
		const erro = template
			.update({ name: "Outro", layers: [foto, { ...foto, id: "f2" }] }, DEPOIS)
			.unwrapErr();
		expect(erro.problems).toContain("O padrão só pode ter uma camada de foto.");
		expect(template.name).toBe("Últimas — feed");
		expect(template.version).toBe(1);
	});

	it("trocar para 9:16 um padrão que é do feed é recusado", () => {
		const template = padrao().unwrap();
		template.setDefaultFor(["INSTAGRAM"], DEPOIS);
		expect(template.update({ format: "9:16" }, DEPOIS).isErr()).toBe(true);
		expect(template.format).toBe("4:5");
	});
});

describe("archive", () => {
	it("sai da escolha e deixa de ser padrão de qualquer destino", () => {
		const template = padrao().unwrap();
		template.setDefaultFor(["INSTAGRAM", "FACEBOOK"], CRIADO);
		template.archive(DEPOIS);
		expect(template.archived).toBe(true);
		expect(template.defaultFor).toEqual([]);
		expect(template.isDefaultFor("INSTAGRAM")).toBe(false);
	});
});

describe("restore", () => {
	it("reidrata sem revalidar", () => {
		const template = ArtTemplate.restore({
			id: "tpl-antigo",
			name: "",
			format: "1:1",
			layers: [foto, { ...foto, id: "f2" }],
			defaultFor: ["FACEBOOK"],
			version: 7,
			archived: false,
			createdAt: CRIADO,
			updatedAt: DEPOIS,
		});
		expect(template.version).toBe(7);
		expect(template.layers).toHaveLength(2);
		expect(template.isDefaultFor("FACEBOOK")).toBe(true);
	});
});

describe("fontes", () => {
	it("conhece a lista fechada", () => {
		expect(isTemplateFontFamily("Montserrat")).toBe(true);
		expect(isTemplateFontFamily("toString")).toBe(false);
		expect(fontSupports("Montserrat", 900, true)).toBe(true);
		expect(fontSupports("Lora", 900, false)).toBe(false);
	});
});
