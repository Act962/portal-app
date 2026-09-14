import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	EMPTY_DESIGN,
	type Fill,
	rotatedBounds,
	type TemplateVariable,
	templateProblems,
	touchesCanvas,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	base,
	cartao,
	design,
	foto,
	moldura,
	texto,
	tituloEditavel,
	variavel,
} from "./art-fixtures";

const CRIADO = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T13:00:00Z");

const valido = design(
	[
		foto(),
		moldura(),
		cartao(),
		tituloEditavel(),
		texto("botao", "{{chamada}}"),
	],
	[variavel("chamada", "MATÉRIA COMPLETA NOS STORIES")],
);

function problemas(
	elements = valido.elements,
	variables: readonly TemplateVariable[] = valido.variables,
	extra: Partial<Parameters<typeof templateProblems>[0]> = {},
) {
	return templateProblems({
		name: "Últimas",
		format: "4:5",
		design: design(elements, variables),
		defaultFor: [],
		...extra,
	});
}

describe("templateProblems — o padrão válido", () => {
	it("a arte do cliente (foto, moldura, cartão, título e botão) não tem problema", () => {
		expect(problemas()).toEqual([]);
	});
});

describe("templateProblems — nome, formato e destinos", () => {
	it("nome vazio ou longo, formato desconhecido", () => {
		expect(problemas(undefined, undefined, { name: "  " })).toContain(
			"Dê um nome ao padrão.",
		);
		expect(
			problemas(undefined, undefined, { name: "a".repeat(61) })[0],
		).toContain("60 caracteres");
		expect(
			problemas(undefined, undefined, { format: "3:2" as never }),
		).toContain("Formato desconhecido: 3:2.");
	});

	it("formato que não serve ao destino de que é padrão", () => {
		expect(
			problemas(undefined, undefined, { defaultFor: ["INSTAGRAM_STORIES"] }),
		).toContain("Um padrão 4:5 não pode ser o padrão de Stories do Instagram.");
	});

	it("cor de fundo do quadro inválida", () => {
		expect(
			templateProblems({
				name: "x",
				format: "1:1",
				design: { ...EMPTY_DESIGN, background: "vermelho" },
				defaultFor: [],
			}),
		).toEqual(["Cor de fundo do quadro inválida (vermelho)."]);
	});
});

describe("templateProblems — elementos", () => {
	it("dois lugares de foto, id vazio ou repetido", () => {
		expect(problemas([foto("a"), foto("b")])).toContain(
			"O padrão só pode ter um lugar de foto.",
		);
		expect(problemas([cartao(" ")])).toContain(
			"Elemento 1: falta o identificador.",
		);
		expect(problemas([cartao("c"), cartao("c")])).toContain(
			"Elemento 2: identificador repetido (c).",
		);
	});

	it("nomeia o elemento pelo nome da camada quando tem", () => {
		const nomeado = { ...cartao(), name: "Cartão vermelho", opacity: 2 };
		expect(problemas([nomeado])).toEqual([
			'"Cartão vermelho": a opacidade vai de 0 a 1.',
		]);
	});

	it("geometria: número inválido, sem tamanho, todo fora do quadro", () => {
		expect(problemas([{ ...cartao(), x: Number.NaN }])).toEqual([
			"Elemento 1: posição, tamanho ou rotação inválidos.",
		]);
		expect(problemas([{ ...cartao(), width: 0 }])).toEqual([
			"Elemento 1: a caixa precisa ter largura e altura.",
		]);
		expect(problemas([{ ...cartao(), x: 2000 }])).toEqual([
			"Elemento 1: está todo fora do quadro.",
		]);
		// Sangrar para fora é normal: a moldura maior que o quadro.
		expect(problemas([{ ...moldura(), x: -40, width: 1160 }])).toEqual([]);
	});

	it("forma: cor, arredondamento, contorno e sombra", () => {
		const forma = {
			...cartao(),
			fill: { type: "solid", color: "red" } as Fill,
			cornerRadius: -1,
			stroke: { color: "#000000", width: 500 },
			shadow: {
				color: "#000000",
				blur: -1,
				offsetX: 0,
				offsetY: Number.POSITIVE_INFINITY,
				opacity: 3,
			},
		};
		expect(problemas([forma])).toEqual([
			"Elemento 1: cor inválida (red).",
			"Elemento 1: o arredondamento não pode ser negativo.",
			"Elemento 1: a espessura do contorno vai de 0 a 200.",
			"Elemento 1: o desfoque da sombra vai de 0 a 200.",
			"Elemento 1: a opacidade da sombra vai de 0 a 1.",
			"Elemento 1: deslocamento da sombra inválido.",
		]);
	});

	it("degradê: duas cores no mínimo, paradas de 0 a 1 em ordem", () => {
		const degrade = (fill: Fill) => problemas([{ ...cartao(), fill }]);
		expect(
			degrade({
				type: "linear",
				angle: 90,
				stops: [{ offset: 0, color: "#000000" }],
			}),
		).toEqual(["Elemento 1: o degradê precisa de ao menos duas cores."]);
		expect(
			degrade({
				type: "linear",
				angle: Number.NaN,
				stops: [
					{ offset: 0.8, color: "#00000000" },
					{ offset: 0.2, color: "#000000cc" },
				],
			}),
		).toEqual([
			"Elemento 1: ângulo do degradê inválido.",
			"Elemento 1: as paradas do degradê vão de 0 a 1, em ordem crescente.",
		]);
		expect(
			degrade({
				type: "linear",
				angle: 90,
				stops: [
					{ offset: 0, color: "#00000000" },
					{ offset: 1, color: "#000000cc" },
				],
			}),
		).toEqual([]);
	});

	it("imagem sem mídia; elipse e linha validam cor e contorno", () => {
		expect(problemas([{ ...moldura(), mediaId: " " }])).toEqual([
			"Elemento 1: escolha a imagem da biblioteca.",
		]);
		expect(
			problemas([
				{
					...base("e"),
					kind: "ELLIPSE",
					fill: { type: "solid", color: "#fff" },
					stroke: null,
					shadow: null,
				},
				{ ...base("l"), kind: "LINE", stroke: { color: "#ffffff", width: -1 } },
			]),
		).toEqual([
			"Elemento 1: cor inválida (#fff).",
			"Elemento 2: a espessura do contorno vai de 0 a 200.",
		]);
	});
});

describe("templateProblems — texto (D2, D3)", () => {
	it("Estático precisa de texto; Editável precisa do nome do campo", () => {
		expect(problemas([texto("t", " ", { mode: "STATIC" })])).toEqual([
			"Elemento 1: escreva o texto fixo.",
		]);
		expect(problemas([texto("t", "{{titulo}}", { mode: "EDITABLE" })])).toEqual(
			["Elemento 1: dê um nome ao campo que aparece no post."],
		);
	});

	it("variável que não existe, no Dinâmico e no Editável — no Estático, as chaves são texto", () => {
		expect(problemas([texto("t", "{{titulo}} {{manchete}}")])).toEqual([
			"Elemento 1: a variável {{manchete}} não existe.",
		]);
		expect(problemas([texto("t", "{{manchete}}", { mode: "STATIC" })])).toEqual(
			[],
		);
		expect(problemas([texto("t", "{{chamada}}")], [])).toEqual([
			"Elemento 1: a variável {{chamada}} não existe.",
		]);
	});

	it("fonte, pesos e medidas", () => {
		const estilo = {
			...DEFAULT_TEXT_STYLE,
			fontFamily: "Oswald" as const,
			fontWeight: 900,
			fontSize: 500,
			minFontSize: 4,
			lineHeight: 5,
			letterSpacing: 200,
			maxLines: 0,
			color: "amarelo",
			background: {
				color: "#ffffff",
				radius: -1,
				paddingX: 0,
				paddingY: 0,
				shape: "hug" as const,
			},
		};
		expect(problemas([texto("t", "{{titulo}}", { style: estilo })])).toEqual([
			"Elemento 1: a Oswald não tem no peso 900.",
			"Elemento 1: o tamanho da fonte vai de 8 a 400.",
			"Elemento 1: o tamanho mínimo vai de 8 até o tamanho da fonte.",
			"Elemento 1: a entrelinha vai de 0,6 a 3.",
			"Elemento 1: o espaço entre letras vai de -20 a 100.",
			"Elemento 1: o máximo de linhas vai de 1 a 12.",
			"Elemento 1: cor do texto inválida (amarelo).",
			"Elemento 1: arredondamento e respiro do fundo não podem ser negativos.",
		]);
		expect(
			problemas([
				texto("t", "{{titulo}}", {
					style: { ...DEFAULT_TEXT_STYLE, fontFamily: "Comic Sans" as never },
				}),
			]),
		).toEqual(["Elemento 1: a fonte Comic Sans não está disponível."]);
	});

	it("texto longo demais", () => {
		expect(
			problemas([texto("t", "a".repeat(301), { mode: "STATIC" })]),
		).toEqual(["Elemento 1: o texto passa de 300 caracteres."]);
	});
});

describe("templateProblems — variáveis do padrão", () => {
	it("chave inválida, do sistema, repetida; nome e valor padrão", () => {
		expect(
			problemas(
				[],
				[
					variavel("Chamada"),
					variavel("titulo"),
					variavel("botao"),
					variavel("botao"),
					{ ...variavel("rodape"), label: " " },
					{ ...variavel("selo"), defaultValue: "a".repeat(301) },
				],
			),
		).toEqual([
			"Variável {{Chamada}}: a chave usa só letras minúsculas, números e _, começando por letra.",
			"Variável {{titulo}}: essa chave já é uma variável da matéria.",
			"Variável {{botao}}: chave repetida.",
			"Variável {{rodape}}: dê um nome ao campo.",
			"Variável {{selo}}: o valor padrão passa de 300 caracteres.",
		]);
	});
});

describe("geometria girada", () => {
	it("a caixa envolvente de um retângulo girado 90° troca largura e altura", () => {
		const caixa = rotatedBounds({
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			rotation: 90,
		});
		expect(caixa.width).toBeCloseTo(100);
		expect(caixa.height).toBeCloseTo(200);
		expect(caixa.x).toBeCloseTo(50);
		expect(caixa.y).toBeCloseTo(-50);
	});

	it("girar pode trazer um canto para dentro do quadro", () => {
		const fora = { x: -300, y: 0, width: 280, height: 40, rotation: 0 };
		const canvas = { width: 1080, height: 1350 };
		expect(touchesCanvas(fora, canvas)).toBe(false);
		expect(touchesCanvas({ ...fora, rotation: 90 }, canvas)).toBe(false);
		expect(touchesCanvas({ ...fora, width: 620, rotation: 45 }, canvas)).toBe(
			true,
		);
	});
});

describe("ArtTemplate", () => {
	const criar = (format: "4:5" | "9:16" = "4:5") =>
		ArtTemplate.create({
			id: "tpl-1",
			name: " Últimas ",
			format,
			design: valido,
			createdAt: CRIADO,
		});

	it("nasce na versão 1, sem ser padrão de nada, com o nome limpo", () => {
		const template = criar().unwrap();
		expect(template.name).toBe("Últimas");
		expect(template.version).toBe(1);
		expect(template.canvas).toEqual({ width: 1080, height: 1350 });
		expect(template.photoElement?.id).toBe("foto");
		expect(template.textElements.map((element) => element.id)).toEqual([
			"titulo",
			"botao",
		]);
		expect(template.variables.map((variable) => variable.key)).toEqual([
			"chamada",
		]);
	});

	it("guarda uma cópia: mexer no objeto de quem chamou não muda o padrão", () => {
		const elementos = [cartao()];
		const template = ArtTemplate.create({
			id: "tpl",
			name: "x",
			format: "1:1",
			design: design(elementos),
			createdAt: CRIADO,
		}).unwrap();
		(elementos[0] as { x: number }).x = 999;
		expect(template.elements[0]?.x).toBe(80);
	});

	it("as mídias em uso, sem repetir", () => {
		const template = ArtTemplate.create({
			id: "tpl",
			name: "x",
			format: "4:5",
			design: design([
				moldura("a", "m-1"),
				moldura("b", "m-1"),
				moldura("c", "m-2"),
			]),
			createdAt: CRIADO,
		}).unwrap();
		expect(template.mediaIds).toEqual(["m-1", "m-2"]);
	});

	it("inválido não nasce", () => {
		const erro = ArtTemplate.create({
			id: "tpl",
			name: "",
			format: "4:5",
			createdAt: CRIADO,
		}).unwrapErr();
		expect(erro.name).toBe("InvalidArtTemplate");
		expect(erro.problems).toEqual(["Dê um nome ao padrão."]);
	});

	it("editar o desenho sobe a versão; com problema, nada muda", () => {
		const template = criar().unwrap();
		expect(template.update({ design: EMPTY_DESIGN }, DEPOIS).isOk()).toBe(true);
		expect(template.version).toBe(2);
		expect(template.updatedAt).toEqual(DEPOIS);
		expect(template.photoElement).toBeNull();

		expect(template.update({ name: "", design: valido }, DEPOIS).isErr()).toBe(
			true,
		);
		expect(template.version).toBe(2);
		expect(template.elements).toEqual([]);
	});

	it("marcar destino não sobe a versão; arquivar tira dos destinos", () => {
		const template = criar().unwrap();
		expect(
			template.setDefaultFor(["INSTAGRAM", "INSTAGRAM"], DEPOIS).isOk(),
		).toBe(true);
		expect(template.defaultFor).toEqual(["INSTAGRAM"]);
		expect(template.version).toBe(1);
		expect(template.isDefaultFor("INSTAGRAM")).toBe(true);
		expect(template.setDefaultFor(["INSTAGRAM_STORIES"], DEPOIS).isErr()).toBe(
			true,
		);

		template.archive(DEPOIS);
		expect(template.archived).toBe(true);
		expect(template.defaultFor).toEqual([]);
		expect(template.isDefaultFor("INSTAGRAM")).toBe(false);
	});
});
