import { DEFAULT_TEXT_STYLE, type TemplateLayer } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	addLayer,
	coversMostOfCanvas,
	duplicateLayer,
	fitScale,
	layerLabel,
	MIN_BOX,
	moveBox,
	moveLayer,
	nearestWeight,
	newLayer,
	removeLayer,
	rescaleLayers,
	resizeBox,
	snapBox,
	toCanvas,
	updateLayer,
	withFontFamily,
} from "@/app/(app)/dashboard/social/padroes/template-editor-model";

const caixa = { x: 100, y: 200, width: 300, height: 150 };

const texto = (
	overrides: Partial<Extract<TemplateLayer, { kind: "TEXT" }>> = {},
) =>
	({
		id: "t",
		kind: "TEXT",
		box: caixa,
		source: "HEADLINE",
		text: "",
		style: { ...DEFAULT_TEXT_STYLE },
		...overrides,
	}) as TemplateLayer;

describe("layerLabel", () => {
	it("nomeia pela origem do texto, e mostra o começo do texto fixo", () => {
		expect(layerLabel(texto())).toBe("Título da matéria");
		expect(layerLabel(texto({ source: "KICKER" }))).toBe("Chapéu");
		expect(layerLabel(texto({ source: "STATIC", text: "  " }))).toBe(
			"Texto fixo",
		);
		expect(
			layerLabel(
				texto({ source: "STATIC", text: "Matéria completa nos stories" }),
			),
		).toBe("Texto fixo: Matéria completa nos st…");
		expect(layerLabel(texto({ source: "STATIC", text: "Leia" }))).toBe(
			"Texto fixo: Leia",
		);
	});

	it("as outras camadas pelo tipo", () => {
		expect(layerLabel(newLayer("PHOTO", "4:5", "f"))).toBe("Foto da matéria");
		expect(layerLabel(newLayer("SHAPE", "4:5", "s"))).toBe("Forma");
		expect(layerLabel(newLayer("IMAGE", "4:5", "i"))).toBe("Imagem");
	});
});

describe("newLayer", () => {
	it("foto e imagem cobrem o quadro do formato", () => {
		expect(newLayer("PHOTO", "9:16", "f").box).toEqual({
			x: 0,
			y: 0,
			width: 1080,
			height: 1920,
		});
		expect(newLayer("IMAGE", "4:5", "i", { mediaId: "m-1" })).toMatchObject({
			box: { width: 1080, height: 1350 },
			mediaId: "m-1",
			fit: "cover",
		});
	});

	it("forma e texto nascem centrados, dentro do quadro", () => {
		const forma = newLayer("SHAPE", "1:1", "s");
		expect(forma.box.x + forma.box.width / 2).toBeCloseTo(540, 0);
		expect(forma.box.y + forma.box.height / 2).toBeCloseTo(540, 0);
		const titulo = newLayer("TEXT", "4:5", "t");
		expect(titulo).toMatchObject({ source: "HEADLINE", text: "" });
		expect(titulo.box.x).toBeGreaterThan(0);
		expect(titulo.box.x + titulo.box.width).toBeLessThan(1080);
	});

	it("o texto novo cabe dentro da forma nova", () => {
		// Visto no editor: com o texto mais largo que o cartão, as pontas das
		// linhas ficavam de fora — branco sobre branco, pareciam cortadas.
		for (const format of ["1:1", "4:5", "9:16"] as const) {
			const cartao = newLayer("SHAPE", format, "s").box;
			const titulo = newLayer("TEXT", format, "t").box;
			expect(titulo.x).toBeGreaterThanOrEqual(cartao.x);
			expect(titulo.x + titulo.width).toBeLessThanOrEqual(
				cartao.x + cartao.width,
			);
		}
	});
});

describe("pilha de camadas", () => {
	const a = newLayer("SHAPE", "4:5", "a");
	const b = newLayer("TEXT", "4:5", "b");

	it("a foto entra no fundo; o resto, no topo", () => {
		const foto = newLayer("PHOTO", "4:5", "foto");
		expect(addLayer([a, b], foto).map((l) => l.id)).toEqual(["foto", "a", "b"]);
		const c = newLayer("SHAPE", "4:5", "c");
		expect(addLayer([a, b], c).map((l) => l.id)).toEqual(["a", "b", "c"]);
	});

	it("sobe e desce uma posição; nas pontas, não mexe", () => {
		expect(moveLayer([a, b], "a", "up").map((l) => l.id)).toEqual(["b", "a"]);
		expect(moveLayer([a, b], "b", "down").map((l) => l.id)).toEqual(["b", "a"]);
		expect(moveLayer([a, b], "b", "up").map((l) => l.id)).toEqual(["a", "b"]);
		expect(moveLayer([a, b], "a", "down").map((l) => l.id)).toEqual(["a", "b"]);
		expect(moveLayer([a, b], "nada", "up").map((l) => l.id)).toEqual([
			"a",
			"b",
		]);
	});

	it("atualiza e remove pela id, sem tocar nas outras", () => {
		const atualizadas = updateLayer([a, b], "a", (layer) => ({
			...layer,
			box: caixa,
		}));
		expect(atualizadas[0]?.box).toEqual(caixa);
		expect(atualizadas[1]).toBe(b);
		expect(removeLayer([a, b], "a").map((l) => l.id)).toEqual(["b"]);
	});

	it("duplica logo acima, deslocada — e não duplica a foto", () => {
		const copia = duplicateLayer([a, b], "a", "a2");
		expect(copia.map((l) => l.id)).toEqual(["a", "a2", "b"]);
		expect(copia[1]?.box).toEqual(moveBox(a.box, 24, 24));
		const foto = newLayer("PHOTO", "4:5", "foto");
		expect(duplicateLayer([foto], "foto", "f2")).toHaveLength(1);
		expect(duplicateLayer([a], "nada", "x")).toHaveLength(1);
	});
});

describe("resizeBox", () => {
	it("pelo leste e pelo sul, só cresce a largura e a altura", () => {
		expect(resizeBox(caixa, "se", 50, 20)).toEqual({
			x: 100,
			y: 200,
			width: 350,
			height: 170,
		});
	});

	it("pelo oeste e pelo norte, a ORIGEM anda e a borda oposta fica parada", () => {
		const nova = resizeBox(caixa, "nw", 40, 30);
		expect(nova).toEqual({ x: 140, y: 230, width: 260, height: 120 });
		expect(nova.x + nova.width).toBe(caixa.x + caixa.width);
		expect(nova.y + nova.height).toBe(caixa.y + caixa.height);
	});

	it("alças do meio mexem em um eixo só", () => {
		expect(resizeBox(caixa, "n", 999, -10)).toEqual({
			x: 100,
			y: 190,
			width: 300,
			height: 160,
		});
		expect(resizeBox(caixa, "e", 10, 999)).toMatchObject({
			width: 310,
			height: 150,
		});
	});

	it("no tamanho mínimo, a borda que se move para — sem inverter a caixa", () => {
		const encolhida = resizeBox(caixa, "w", 1000, 0);
		expect(encolhida.width).toBe(MIN_BOX);
		expect(encolhida.x + encolhida.width).toBe(caixa.x + caixa.width);
		expect(resizeBox(caixa, "s", 0, -1000).height).toBe(MIN_BOX);
	});
});

describe("snapBox", () => {
	const quadro = { width: 1080, height: 1350 };

	it("encosta nas bordas e no centro quando passa perto", () => {
		expect(
			snapBox({ x: 6, y: 1342 - 100, width: 200, height: 100 }, quadro, 10),
		).toMatchObject({ x: 0, y: 1250 });
		// Centro horizontal: 540 − 150 = 390.
		expect(
			snapBox({ x: 395, y: 500, width: 300, height: 100 }, quadro, 10).x,
		).toBe(390);
	});

	it("longe das guias, não mexe", () => {
		const longe = { x: 200, y: 300, width: 100, height: 100 };
		expect(snapBox(longe, quadro, 10)).toEqual(longe);
	});
});

describe("escala", () => {
	it("encolhe para caber, sem nunca ampliar", () => {
		expect(
			fitScale({ width: 1080, height: 1350 }, { width: 540, height: 2000 }),
		).toBe(0.5);
		expect(
			fitScale({ width: 1080, height: 1920 }, { width: 2000, height: 960 }),
		).toBe(0.5);
		expect(
			fitScale({ width: 1080, height: 1080 }, { width: 5000, height: 5000 }),
		).toBe(1);
		expect(
			fitScale({ width: 1080, height: 1080 }, { width: 0, height: 500 }),
		).toBe(1);
	});

	it("converte o arrasto da tela para pixels do quadro", () => {
		expect(toCanvas(50, 0.5)).toBe(100);
		expect(toCanvas(50, 0)).toBe(50);
	});
});

describe("coversMostOfCanvas", () => {
	const quadro = { width: 1080, height: 1350 };

	it("a moldura do tamanho da arte cobre; a caixa do título, não", () => {
		expect(
			coversMostOfCanvas({ x: 0, y: 0, width: 1080, height: 1350 }, quadro),
		).toBe(true);
		expect(
			coversMostOfCanvas({ x: 130, y: 560, width: 800, height: 240 }, quadro),
		).toBe(false);
	});

	it("conta só a parte visível — sangrar para fora não conta a mais", () => {
		expect(
			coversMostOfCanvas({ x: -500, y: 0, width: 1080, height: 1350 }, quadro),
		).toBe(false);
		expect(
			coversMostOfCanvas({ x: -20, y: -20, width: 1120, height: 1390 }, quadro),
		).toBe(true);
	});
});

describe("fontes no editor", () => {
	it("peso mais próximo, com o mais leve no empate", () => {
		expect(nearestWeight([400, 500, 600, 700], 900)).toBe(700);
		expect(nearestWeight([400, 600], 500)).toBe(400);
		expect(nearestWeight([], 800)).toBe(800);
	});

	it("trocar de família ajusta peso e itálico ao que a nova tem", () => {
		const black = {
			...DEFAULT_TEXT_STYLE,
			fontFamily: "Montserrat" as const,
			fontWeight: 900,
			italic: true,
		};
		expect(withFontFamily(black, "Oswald")).toMatchObject({
			fontFamily: "Oswald",
			fontWeight: 700,
			italic: false,
		});
		expect(withFontFamily(black, "Poppins")).toMatchObject({
			fontWeight: 900,
			italic: true,
		});
	});
});

describe("rescaleLayers", () => {
	it("mantém a posição relativa ao trocar de formato", () => {
		const titulo = newLayer("TEXT", "4:5", "t");
		const [levado] = rescaleLayers([titulo], "4:5", "9:16");
		const meio = (b: { y: number; height: number }, total: number) =>
			(b.y + b.height / 2) / total;
		expect(meio(levado?.box ?? titulo.box, 1920)).toBeCloseTo(
			meio(titulo.box, 1350),
			2,
		);
	});

	it("mesmo formato devolve as camadas como estão", () => {
		const forma = newLayer("SHAPE", "1:1", "s");
		expect(rescaleLayers([forma], "1:1", "1:1")).toEqual([forma]);
	});
});
