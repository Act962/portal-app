import { type VideoClip, videoFrameFor } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import { cartao, design, foto, moldura, texto } from "./art-fixtures";

const CORTE: VideoClip = {
	mediaId: "video-1",
	sourceSeconds: 60,
	startSeconds: 4,
	endSeconds: 20,
	muted: false,
};

const em916 = (elements: Parameters<typeof design>[0]) =>
	videoFrameFor({ format: "9:16", design: design(elements), clips: [CORTE] });

describe("videoFrameFor — a caixa", () => {
	it("o vídeo ocupa o lugar da foto do padrão", () => {
		const lugar = { ...foto(), x: 60, y: 200, width: 960, height: 540 };
		const frame = em916([lugar]);
		expect(frame.box).toEqual({ x: 60, y: 200, width: 960, height: 540 });
		expect(frame.canvas).toEqual({ width: 1080, height: 1920 });
	});

	it("sem lugar de foto, o vídeo ocupa o quadro inteiro", () => {
		// É o que faz um padrão de moldura — só a faixa e o logo — servir ao
		// vídeo sem ser redesenhado.
		const frame = em916([moldura()]);
		expect(frame.box).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
		expect(frame.over.elements).toHaveLength(1);
		expect(frame.under.elements).toHaveLength(0);
	});

	it("lugar de foto ESCONDIDO não conta — o vídeo vai para o quadro inteiro", () => {
		const frame = em916([{ ...foto(), visible: false }]);
		expect(frame.box.height).toBe(1920);
	});

	it("arredonda a caixa para pixel inteiro e nunca a deixa zerada", () => {
		const frame = em916([{ ...foto(), width: 0, height: 10.4 }]);
		expect(frame.box.width).toBe(1);
		expect(frame.box.height).toBe(10);
	});
});

describe("videoFrameFor — as camadas", () => {
	it("o que está sob o lugar da foto vai para BAIXO; o que está sobre, para CIMA", () => {
		const frame = em916([cartao("fundo"), foto(), texto("titulo")]);
		expect(frame.under.elements.map((e) => e.id)).toEqual(["fundo"]);
		// O primeiro de cima é o próprio lugar da foto, virado contorno.
		expect(frame.over.elements.map((e) => e.id)).toEqual(["foto", "titulo"]);
	});

	it("a camada de baixo leva o fundo do quadro; a de cima é transparente", () => {
		const frame = videoFrameFor({
			format: "9:16",
			design: { ...design([foto()]), background: "#c1121f" },
			clips: [CORTE],
		});
		expect(frame.under.background).toBe("#c1121f");
		// Pintar o fundo duas vezes apagaria o vídeo do meio.
		expect(frame.over.background).toBe("#00000000");
	});

	it("o lugar da foto sobe como contorno: sem preenchimento, com o traço", () => {
		// É o que põe a moldura e o canto arredondado SOBRE o vídeo, em vez de
		// atrás dele — sem reimplementar o desenho do contorno.
		const stroke = { color: "#ffffff", width: 8 };
		const frame = em916([{ ...foto(), cornerRadius: 48, stroke }]);
		const outline = frame.over.elements[0];
		expect(outline?.kind).toBe("RECT");
		expect(outline).toMatchObject({
			cornerRadius: 48,
			stroke,
			fill: { type: "solid", color: "#00000000" },
		});
	});
});

describe("videoFrameFor — o recorte e o trecho", () => {
	it("leva os trechos escolhidos, já em duração", () => {
		const frame = em916([foto()]);
		expect(frame.segments).toEqual([
			{
				mediaId: "video-1",
				startSeconds: 4,
				durationSeconds: 16,
				muted: false,
			},
		]);
	});

	it("vários trechos viram vários segmentos, NA ORDEM", () => {
		// O quadro é UM (a caixa, a rotação, o arredondamento não mudam de um
		// trecho para o outro); o que varia é qual pedaço entra nele.
		const frame = videoFrameFor({
			format: "9:16",
			design: design([foto()]),
			clips: [
				CORTE,
				{ ...CORTE, mediaId: "video-2", startSeconds: 0, endSeconds: 5 },
			],
		});
		expect(frame.segments.map((s) => s.mediaId)).toEqual([
			"video-1",
			"video-2",
		]);
		expect(frame.segments.map((s) => s.durationSeconds)).toEqual([16, 5]);
		expect(frame.box).toEqual(frame.box);
	});

	it("o ponto focal vai como fração; o centro é o padrão", () => {
		expect(em916([foto()]).focal).toEqual({ x: 0.5, y: 0.5 });
		expect(
			videoFrameFor({
				format: "9:16",
				design: design([foto()]),
				focal: { x: 0.2, y: 0.9 },
				clips: [CORTE],
			}).focal,
		).toEqual({ x: 0.2, y: 0.9 });
	});

	it("ponto focal fora do quadrado unitário é preso na borda", () => {
		const frame = videoFrameFor({
			format: "9:16",
			design: design([foto()]),
			focal: { x: -1, y: Number.NaN },
			clips: [CORTE],
		});
		expect(frame.focal).toEqual({ x: 0, y: 0.5 });
	});

	it("só pede máscara quando o canto é arredondado", () => {
		// Máscara custa um PNG a mais e dois filtros; o caso comum não paga.
		expect(em916([foto()]).masked).toBe(false);
		expect(em916([{ ...foto(), cornerRadius: 24 }]).masked).toBe(true);
	});

	it("a caixa girada leva junto a envolvente, que é onde ela encosta no quadro", () => {
		const frame = em916([
			{ ...foto(), x: 0, y: 0, width: 400, height: 200, rotation: 90 },
		]);
		expect(frame.rotation).toBe(90);
		expect(frame.bounds.width).toBeCloseTo(200);
		expect(frame.bounds.height).toBeCloseTo(400);
	});
});
