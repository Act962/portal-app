import {
	type ArtDesign,
	type ArtElement,
	DEFAULT_TEXT_STYLE,
	type TextElement,
	templateProblems,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	addVariable,
	alignElements,
	commit,
	copiesOf,
	distributeElements,
	duplicateElements,
	geometryFromNode,
	historyOf,
	insertToken,
	keyFromLabel,
	layerName,
	moveElements,
	moveInStack,
	moveToIndex,
	nearestWeight,
	newElement,
	normalizeRotation,
	redo,
	reframeDesign,
	removeElements,
	removeVariable,
	replacePresent,
	snapBounds,
	undo,
	updateVariable,
	variableUsage,
	withFontFamily,
} from "@/app/(app)/dashboard/social/padroes/editor/editor-model";

const CANVAS = { width: 1080, height: 1350 };

function caixa(
	id: string,
	x: number,
	y: number,
	extra: Partial<ArtElement> = {},
) {
	return {
		...newElement("RECT", "4:5", id),
		x,
		y,
		width: 100,
		height: 100,
		...extra,
	} as ArtElement;
}

function desenho(elements: ArtElement[]): ArtDesign {
	return { background: "#ffffff", elements, variables: [] };
}

const ids = (design: ArtDesign) => design.elements.map((element) => element.id);

describe("newElement", () => {
	it("todo tipo nasce válido para o domínio", () => {
		for (const kind of ["PHOTO", "RECT", "ELLIPSE", "LINE", "TEXT"] as const) {
			const elemento = newElement(kind, "4:5", `id-${kind}`);
			expect(
				templateProblems({
					name: "x",
					format: "4:5",
					design: desenho([elemento]),
					defaultFor: [],
				}),
			).toEqual([]);
		}
	});

	it("imagem com proporção conhecida ocupa a largura, centralizada; sem, o quadro", () => {
		const logo = newElement("IMAGE", "4:5", "i", {
			mediaId: "m",
			imageSize: { width: 1080, height: 270 },
		});
		expect(logo).toMatchObject({ x: 0, y: 540, width: 1080, height: 270 });
		expect(newElement("IMAGE", "9:16", "m", { mediaId: "m" })).toMatchObject({
			x: 0,
			y: 0,
			width: 1080,
			height: 1920,
		});
	});

	it("o nome da camada: o dado, o texto ou o tipo", () => {
		expect(layerName({ ...newElement("TEXT", "1:1", "t"), name: "" })).toBe(
			"{{titulo}}",
		);
		expect(layerName({ ...newElement("RECT", "1:1", "r"), name: " " })).toBe(
			"Retângulo",
		);
		expect(layerName(newElement("PHOTO", "1:1", "f"))).toBe("Foto da matéria");
	});
});

describe("pilha", () => {
	const base = desenho([
		caixa("a", 0, 0),
		caixa("b", 0, 0),
		caixa("c", 0, 0),
		caixa("d", 0, 0),
	]);

	it("um degrau para frente e para trás, com a seleção junta", () => {
		expect(ids(moveInStack(base, ["a", "b"], "forward"))).toEqual([
			"c",
			"a",
			"b",
			"d",
		]);
		expect(ids(moveInStack(base, ["d"], "backward"))).toEqual([
			"a",
			"b",
			"d",
			"c",
		]);
		expect(ids(moveInStack(base, ["d"], "forward"))).toEqual(ids(base));
	});

	it("até a frente e até o fundo, mantendo a ordem da seleção", () => {
		expect(ids(moveInStack(base, ["c", "a"], "front"))).toEqual([
			"b",
			"d",
			"a",
			"c",
		]);
		expect(ids(moveInStack(base, ["d", "b"], "back"))).toEqual([
			"b",
			"d",
			"a",
			"c",
		]);
	});

	it("arrastar no painel põe no índice", () => {
		expect(ids(moveToIndex(base, "a", 3))).toEqual(["b", "c", "d", "a"]);
		expect(ids(moveToIndex(base, "nada", 0))).toEqual(ids(base));
	});

	it("duplicar e colar deslocam e não copiam a segunda foto", () => {
		let contador = 0;
		const novoId = () => `novo-${++contador}`;
		const comFoto = desenho([
			newElement("PHOTO", "4:5", "foto"),
			caixa("a", 10, 10),
		]);
		const duplicado = duplicateElements(comFoto, ["foto", "a"], novoId);
		expect(duplicado.ids).toEqual(["novo-1"]);
		expect(duplicado.design.elements.at(-1)).toMatchObject({
			id: "novo-1",
			x: 34,
			y: 34,
		});

		const colado = copiesOf(desenho([]), comFoto.elements, novoId, 0);
		expect(colado.ids).toHaveLength(2);
	});

	it("remover e mover respeitam a trava", () => {
		const travado = desenho([
			caixa("a", 0, 0),
			caixa("b", 0, 0, { locked: true }),
		]);
		expect(
			moveElements(travado, ["a", "b"], 5, 7).elements.map((e) => [e.x, e.y]),
		).toEqual([
			[5, 7],
			[0, 0],
		]);
		expect(ids(removeElements(travado, ["a"]))).toEqual(["b"]);
	});
});

describe("alinhar e distribuir", () => {
	it("um só alinha ao quadro; vários, à seleção", () => {
		const um = alignElements(
			desenho([caixa("a", 10, 10)]),
			["a"],
			"hcenter",
			CANVAS,
		);
		expect(um.elements[0]?.x).toBe(490);

		const varios = alignElements(
			desenho([caixa("a", 10, 10), caixa("b", 300, 500)]),
			["a", "b"],
			"bottom",
			CANVAS,
		);
		expect(varios.elements.map((e) => e.y)).toEqual([500, 500]);
	});

	it("alinha pela caixa girada", () => {
		const girada = caixa("a", 100, 100, {
			width: 200,
			height: 100,
			rotation: 90,
		});
		const alinhada = alignElements(desenho([girada]), ["a"], "left", CANVAS);
		// Girada 90°, a caixa visível tem 100 de largura e começa 50 px à direita.
		expect(alinhada.elements[0]?.x).toBe(-50);
	});

	it("distribui com espaços iguais, pontas paradas; menos de três não mexe", () => {
		const tres = desenho([
			caixa("a", 0, 0),
			caixa("b", 150, 0),
			caixa("c", 900, 0),
		]);
		expect(
			distributeElements(tres, ["a", "b", "c"], "horizontal").elements.map(
				(e) => e.x,
			),
		).toEqual([0, 450, 900]);
		expect(distributeElements(tres, ["a", "b"], "horizontal")).toBe(tres);
	});
});

describe("guias magnéticas", () => {
	it("encosta no centro do quadro dentro do limite", () => {
		const encaixe = snapBounds(
			{ x: 485, y: 20, width: 100, height: 100 },
			[],
			CANVAS,
			8,
		);
		expect(encaixe.dx).toBe(5);
		expect(encaixe.guides.vertical).toEqual([540]);
		expect(encaixe.dy).toBe(0);
		expect(encaixe.guides.horizontal).toEqual([]);
	});

	it("encosta na borda de outro elemento", () => {
		const encaixe = snapBounds(
			{ x: 203, y: 604, width: 100, height: 100 },
			[{ x: 100, y: 700, width: 100, height: 50 }],
			CANVAS,
			6,
		);
		expect(encaixe.dx).toBe(-3);
		expect(encaixe.dy).toBe(-4);
	});
});

describe("geometria do nó", () => {
	it("do centro e da escala para a caixa, com a rotação normalizada", () => {
		expect(
			geometryFromNode({
				x: 600,
				y: 400,
				width: 200,
				height: 100,
				scaleX: 1.5,
				scaleY: -2,
				rotation: 370,
			}),
		).toEqual({ x: 450, y: 300, width: 300, height: 200, rotation: 10 });
		expect(normalizeRotation(-190)).toBe(170);
		expect(normalizeRotation(180)).toBe(180);
	});

	it("trocar o formato estica o que ocupa a altura e recentraliza o resto", () => {
		const mudado = reframeDesign(
			desenho([newElement("PHOTO", "4:5", "foto"), caixa("a", 0, 600)]),
			"4:5",
			"9:16",
		);
		expect(mudado.elements[0]?.height).toBe(1920);
		expect(mudado.elements[1]?.y).toBe(885);
	});
});

describe("desfazer (D10)", () => {
	it("guarda, desfaz, refaz e descarta o futuro ao mudar", () => {
		let historia = historyOf("a");
		historia = commit(historia, "b");
		historia = commit(historia, "c");
		historia = undo(historia);
		expect(historia.present).toBe("b");
		historia = redo(historia);
		expect(historia.present).toBe("c");
		historia = undo(undo(historia));
		historia = commit(historia, "x");
		expect(historia).toEqual({ past: ["a"], present: "x", future: [] });
		expect(undo(historyOf("só")).present).toBe("só");
		expect(redo(historia)).toBe(historia);
	});

	it("tem limite, ignora a mesma referência e junta teclas com replacePresent", () => {
		let historia = historyOf(0);
		for (let passo = 1; passo <= 5; passo += 1) {
			historia = commit(historia, passo, 3);
		}
		expect(historia.past).toEqual([2, 3, 4]);
		expect(commit(historia, 5)).toBe(historia);
		expect(replacePresent(historia, 9)).toEqual({
			past: [2, 3, 4],
			present: 9,
			future: [],
		});
	});
});

describe("variáveis", () => {
	it("a chave sai do nome, sem acento, livre e fora das do sistema", () => {
		expect(keyFromLabel("Chamada do botão", [])).toBe("chamada_do_botao");
		expect(keyFromLabel("Título", [])).toBe("titulo_2");
		expect(keyFromLabel("chamada", ["chamada", "chamada_2"])).toBe("chamada_3");
		expect(keyFromLabel("2 linhas!", [])).toBe("v_2_linhas");
		expect(keyFromLabel("???", [])).toBe("variavel");
	});

	it("criar, renomear a chave nas caixas, contar o uso e apagar", () => {
		const texto: ArtElement = {
			...(newElement("TEXT", "4:5", "t") as TextElement),
			content: "Leia {{ chamada }} e {{chamada}}",
			style: { ...DEFAULT_TEXT_STYLE },
		};
		const fixo: ArtElement = {
			...(newElement("TEXT", "4:5", "f") as TextElement),
			mode: "STATIC",
			content: "{{chamada}}",
		};
		const criado = addVariable(desenho([texto, fixo]), "Chamada");
		expect(criado.key).toBe("chamada");
		expect(variableUsage(criado.design, "chamada")).toBe(1);

		const renomeado = updateVariable(criado.design, "chamada", {
			key: "botao",
			label: "Botão",
		});
		expect(renomeado.variables[0]).toMatchObject({
			key: "botao",
			label: "Botão",
		});
		expect(
			renomeado.elements.map((e) => (e.kind === "TEXT" ? e.content : "")),
		).toEqual(["Leia {{botao}} e {{botao}}", "{{chamada}}"]);
		expect(removeVariable(renomeado, "botao").variables).toEqual([]);
	});

	it("insere o marcador no cursor, trocando a seleção", () => {
		expect(insertToken("Leia em ", 8, 8, "editoria")).toEqual({
			text: "Leia em {{editoria}}",
			caret: 20,
		});
		expect(insertToken("Leia XXX agora", 5, 8, "site")).toEqual({
			text: "Leia {{site}} agora",
			caret: 13,
		});
	});
});

describe("fontes", () => {
	it("trocar de família leva o peso mais próximo e o itálico só se houver", () => {
		expect(nearestWeight("Oswald", 900)).toBe(700);
		expect(
			withFontFamily(
				{ ...DEFAULT_TEXT_STYLE, fontWeight: 800, italic: true },
				"Oswald",
			),
		).toMatchObject({ fontFamily: "Oswald", fontWeight: 700, italic: false });
	});
});
