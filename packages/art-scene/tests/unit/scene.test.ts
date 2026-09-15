import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	type ArtContent,
	type ArtDesign,
	type ArtElement,
	DEFAULT_TEXT_STYLE,
	type TextElement,
} from "@portal-app/social";
import Konva from "konva";
import "konva/skia-backend";
import { FontLibrary } from "skia-canvas";
import { beforeAll, describe, expect, it } from "vitest";

import {
	buildArtLayer,
	containBox,
	ELEMENT_NODE,
	fitText,
	fontStyleOf,
	gradientPoints,
	PHOTO_PLACEHOLDER,
	textNodes,
	textWarnings,
} from "../../src/scene";

const FONTES = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../node_modules/@fontsource/montserrat/files",
);

beforeAll(() => {
	FontLibrary.use("Montserrat", [
		join(FONTES, "montserrat-latin-400-normal.woff"),
		join(FONTES, "montserrat-latin-800-normal.woff"),
		join(FONTES, "montserrat-latin-800-italic.woff"),
	]);
});

const CONTEUDO: ArtContent = {
	headline: "Chuva alaga o centro",
	subtitle: null,
	kicker: "Últimas",
	sectionName: "Cidades",
	authorName: null,
	siteName: null,
	date: null,
};

const base = {
	name: "",
	x: 100,
	y: 200,
	width: 600,
	height: 300,
	rotation: 0,
	opacity: 1,
	visible: true,
	locked: false,
};

function texto(extra: Partial<TextElement> = {}): TextElement {
	return {
		...base,
		id: "t",
		kind: "TEXT",
		mode: "DYNAMIC",
		content: "{{titulo}}",
		fieldLabel: "",
		style: { ...DEFAULT_TEXT_STYLE, fontSize: 60, minFontSize: 30 },
		...extra,
	};
}

const retangulo: ArtElement = {
	...base,
	id: "r",
	kind: "RECT",
	fill: { type: "solid", color: "#d9232e" },
	cornerRadius: 0,
	stroke: null,
	shadow: null,
};

function desenho(elements: readonly ArtElement[]): ArtDesign {
	return { background: "#ffffff", elements, variables: [] };
}

function pixel(layer: InstanceType<typeof Konva.Layer>, x: number, y: number) {
	const canvas = layer.toCanvas({
		pixelRatio: 1,
	}) as unknown as HTMLCanvasElement;
	const data = canvas.getContext("2d")?.getImageData(x, y, 1, 1).data;
	return [data?.[0], data?.[1], data?.[2]];
}

describe("peças puras", () => {
	it.each(["vertical", "horizontal"] as const)(
		"repete a foto na direção %s preservando o ponto focal",
		(repeat) => {
			const source = Konva.Util.createCanvasElement();
			source.width = 800;
			source.height = 600;
			const context = source.getContext("2d");
			if (!context) throw new Error("Canvas indisponível");
			context.fillStyle = "#ff0000";
			context.fillRect(0, 0, 800, 600);
			const { layer } = buildArtLayer(Konva, {
				format: "4:5",
				design: desenho([
					{
						...base,
						id: "photo",
						kind: "PHOTO",
						cornerRadius: 20,
						stroke: null,
						repeat,
						repeatCount: 2,
					},
				]),
				content: CONTEUDO,
				assets: {
					images: {},
					photo: {
						image: source,
						width: 800,
						height: 600,
						focal: { x: 1, y: 1 },
					},
				},
			});
			const images = layer.find("Image") as InstanceType<typeof Konva.Image>[];
			expect(images).toHaveLength(2);
			expect(images[0]?.width()).toBe(repeat === "horizontal" ? 300 : 600);
			expect(images[0]?.height()).toBe(repeat === "vertical" ? 150 : 300);
			expect(images[1]?.x()).toBe(repeat === "horizontal" ? 300 : 0);
			expect(images[1]?.y()).toBe(repeat === "vertical" ? 150 : 0);
			expect(images[1]?.crop()).toEqual(images[0]?.crop());
			expect(pixel(layer, 250, 275)).toEqual([255, 0, 0]);
			expect(pixel(layer, 550, 425)).toEqual([255, 0, 0]);
			expect(pixel(layer, 100, 200)).toEqual([255, 255, 255]);
			layer.destroy();
		},
	);
	it("o degradê de 0° vai da esquerda para a direita; o de 90°, de cima para baixo", () => {
		expect(gradientPoints(0, 200, 100)).toEqual({
			start: { x: 0, y: 50 },
			end: { x: 200, y: 50 },
		});
		const vertical = gradientPoints(90, 200, 100);
		expect(vertical.start.x).toBeCloseTo(100);
		expect(vertical.start.y).toBeCloseTo(0);
		expect(vertical.end.y).toBeCloseTo(100);
	});

	it("contain: a imagem inteira, centralizada na caixa", () => {
		expect(
			containBox({ width: 400, height: 200 }, { width: 200, height: 200 }),
		).toEqual({ x: 0, y: 50, width: 200, height: 100 });
	});

	it("fontStyle do Konva com itálico e peso", () => {
		expect(fontStyleOf({ ...DEFAULT_TEXT_STYLE, italic: true })).toBe(
			"italic 800",
		);
		expect(fontStyleOf(DEFAULT_TEXT_STYLE)).toBe("800");
	});
});

describe("fitText (D8) — medido com a fonte de verdade", () => {
	it("texto curto sai no tamanho cheio", () => {
		expect(fitText(Konva, texto(), "Chuva")).toEqual({
			fontSize: 60,
			lines: 1,
			fits: true,
		});
	});

	it("texto longo encolhe até caber", () => {
		const longo =
			"Estudantes de Piracuruca são premiados em olimpíada nacional de matemática";
		const ajuste = fitText(Konva, texto(), longo);
		expect(ajuste.fits).toBe(true);
		expect(ajuste.fontSize).toBeLessThan(60);
		expect(ajuste.fontSize).toBeGreaterThanOrEqual(30);
	});

	it("nem no mínimo coube: avisa, e o texto sai cortado dentro da caixa", () => {
		const caixa = texto({
			height: 80,
			style: { ...texto().style, maxLines: 1 },
		});
		const longo =
			"Uma frase comprida demais para uma linha só nesta caixa estreita";
		expect(fitText(Konva, caixa, longo).fits).toBe(false);
		const { nodes } = textNodes(Konva, caixa, longo);
		const noTexto = nodes.at(-1) as InstanceType<typeof Konva.Text>;
		expect(noTexto.ellipsis()).toBe(true);
		expect(noTexto.textArr).toHaveLength(1);
		expect(
			textWarnings(Konva, {
				design: desenho([{ ...caixa, content: longo, mode: "STATIC" }]),
				content: CONTEUDO,
			}),
		).toEqual([
			`"${longo.slice(0, 30)}" não cabe nem no tamanho mínimo e vai sair cortado.`,
		]);
	});
});

describe("textNodes", () => {
	it("caixa vazia não desenha nada — nem a pílula", () => {
		const pilula = texto({
			style: {
				...texto().style,
				background: {
					color: "#ffffff",
					radius: 30,
					paddingX: 20,
					paddingY: 8,
					shape: "hug",
				},
			},
		});
		expect(textNodes(Konva, pilula, "  ").nodes).toEqual([]);
	});

	it("a pílula abraça o texto e segue o alinhamento", () => {
		const pilula = texto({
			style: {
				...texto().style,
				align: "center",
				maxLines: 1,
				background: {
					color: "#ffffff",
					radius: 30,
					paddingX: 20,
					paddingY: 8,
					shape: "hug",
				},
			},
		});
		const [fundo, noTexto] = textNodes(Konva, pilula, "ÚLTIMAS").nodes as [
			InstanceType<typeof Konva.Rect>,
			InstanceType<typeof Konva.Text>,
		];
		expect(fundo.width()).toBeLessThan(600);
		expect(fundo.width()).toBeCloseTo(noTexto.getTextWidth() + 40);
		expect(fundo.x() + fundo.width() / 2).toBeCloseTo(300);
		expect(fundo.y()).toBeCloseTo(noTexto.y() - 8);
	});

	it("alinhamento vertical embaixo encosta a última linha no pé da caixa", () => {
		const embaixo = texto({
			style: { ...texto().style, verticalAlign: "bottom", lineHeight: 1 },
		});
		const [noTexto] = textNodes(Konva, embaixo, "Chuva").nodes as [
			InstanceType<typeof Konva.Text>,
		];
		expect(noTexto.y()).toBeCloseTo(300 - 60);
	});
});

describe("buildArtLayer", () => {
	it("o fundo e os elementos na ordem da pilha, posicionados pelo centro", () => {
		const girado = { ...retangulo, id: "g", rotation: 30 };
		const { layer } = buildArtLayer(Konva, {
			format: "4:5",
			design: desenho([retangulo, texto(), girado]),
			content: CONTEUDO,
		});
		const grupos = layer.find(`.${ELEMENT_NODE}`);
		expect(grupos.map((grupo) => grupo.id())).toEqual(["r", "t", "g"]);
		const g = grupos[2];
		expect(g?.x()).toBe(400);
		expect(g?.y()).toBe(350);
		expect(g?.offsetX()).toBe(300);
		expect(g?.rotation()).toBe(30);
	});

	it("desenha de verdade: fundo branco fora, vermelho dentro do retângulo", () => {
		const { layer } = buildArtLayer(Konva, {
			format: "1:1",
			design: desenho([retangulo]),
			content: CONTEUDO,
		});
		expect(pixel(layer, 20, 20)).toEqual([255, 255, 255]);
		expect(pixel(layer, 400, 350)).toEqual([217, 35, 46]);
	});

	it("sem foto, o lugar sai em cinza; a moldura que não carregou some — no editor, fica tracejada", () => {
		const foto: ArtElement = {
			...base,
			id: "f",
			kind: "PHOTO",
			cornerRadius: 0,
			stroke: null,
		};
		const moldura: ArtElement = {
			...base,
			id: "m",
			kind: "IMAGE",
			mediaId: "nao-carregou",
			fit: "cover",
			cornerRadius: 0,
		};
		const servidor = buildArtLayer(Konva, {
			format: "1:1",
			design: desenho([foto, moldura]),
			content: CONTEUDO,
		}).layer;
		const [lugarDaFoto, lugarDaMoldura] = servidor.find(`.${ELEMENT_NODE}`) as [
			InstanceType<typeof Konva.Group>,
			InstanceType<typeof Konva.Group>,
		];
		expect(
			(lugarDaFoto.getChildren()[1] as InstanceType<typeof Konva.Rect>).fill(),
		).toBe(PHOTO_PLACEHOLDER);
		expect(lugarDaMoldura.getChildren()).toHaveLength(1);

		const editor = buildArtLayer(Konva, {
			format: "1:1",
			design: desenho([moldura]),
			content: CONTEUDO,
			options: { editor: true },
		}).layer;
		const tracejado = (
			editor.findOne(`.${ELEMENT_NODE}`) as InstanceType<typeof Konva.Group>
		).getChildren()[1] as InstanceType<typeof Konva.Rect>;
		expect(tracejado.dash()).toEqual([16, 12]);
	});

	it("oculto não vai para a arte; no editor aparece apagado", () => {
		const oculto = { ...retangulo, visible: false, opacity: 1 };
		expect(
			buildArtLayer(Konva, {
				format: "1:1",
				design: desenho([oculto]),
				content: CONTEUDO,
			}).layer.find(`.${ELEMENT_NODE}`),
		).toHaveLength(0);
		const noEditor = buildArtLayer(Konva, {
			format: "1:1",
			design: desenho([oculto]),
			content: CONTEUDO,
			options: { editor: true },
		}).layer.find(`.${ELEMENT_NODE}`);
		expect(noEditor[0]?.opacity()).toBeCloseTo(0.3);
	});

	it("o degradê é desenhado do transparente ao escuro", () => {
		const degrade: ArtElement = {
			...retangulo,
			x: 0,
			y: 0,
			width: 1080,
			height: 1080,
			fill: {
				type: "linear",
				angle: 90,
				stops: [
					{ offset: 0, color: "#000000" },
					{ offset: 1, color: "#ffffff" },
				],
			},
		};
		const { layer } = buildArtLayer(Konva, {
			format: "1:1",
			design: desenho([degrade]),
			content: CONTEUDO,
		});
		const [topo] = pixel(layer, 540, 5);
		const [pe] = pixel(layer, 540, 1075);
		expect(topo).toBeLessThan(20);
		expect(pe).toBeGreaterThan(235);
	});
});
