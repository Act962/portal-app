import {
	croppedImageKey,
	focalCrop,
	focalCropTo,
	OUTPUT_SIZE,
	storyLayout,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const CENTRO = { x: 0.5, y: 0.5 };

describe("storyLayout — a foto inteira no quadro 9:16 (§17)", () => {
	it("o quadro é 1080×1920", () => {
		expect(OUTPUT_SIZE["9:16"]).toEqual({ width: 1080, height: 1920 });
	});

	it("foto deitada ocupa a largura e fica centrada na vertical", () => {
		// Cortar em 9:16 deixaria só um terço da foto; aqui ela aparece inteira.
		expect(storyLayout({ width: 2000, height: 1000 })).toEqual({
			left: 0,
			top: 690,
			width: 1080,
			height: 540,
		});
	});

	it("foto mais alta que 9:16 ocupa a altura e centra na horizontal", () => {
		expect(storyLayout({ width: 1000, height: 4000 })).toEqual({
			left: 300,
			top: 0,
			width: 480,
			height: 1920,
		});
	});

	it("foto já em 9:16 preenche o quadro inteiro", () => {
		expect(storyLayout({ width: 540, height: 960 })).toEqual({
			left: 0,
			top: 0,
			width: 1080,
			height: 1920,
		});
	});

	it("foto pequena é ampliada até encostar no quadro", () => {
		expect(storyLayout({ width: 200, height: 100 })).toMatchObject({
			width: 1080,
			height: 540,
		});
	});

	it("dimensão zero não gera largura zero, que o sharp recusa", () => {
		const box = storyLayout({ width: 0, height: 0 });
		expect(box.width).toBeGreaterThanOrEqual(1);
		expect(box.height).toBeGreaterThanOrEqual(1);
	});

	it("o fundo do story usa o corte 9:16 do ponto focal", () => {
		expect(focalCrop({ width: 2000, height: 1000 }, CENTRO, "9:16")).toEqual({
			left: 719,
			top: 0,
			width: 563,
			height: 1000,
		});
		expect(croppedImageKey("m-1", "9:16", CENTRO)).toBe(
			"social/m-1-9x16-500-500.jpg",
		);
	});
});

describe("focalCrop — 1:1", () => {
	it("em foto deitada, pega o maior quadrado, centrado", () => {
		expect(focalCrop({ width: 2000, height: 1000 }, CENTRO, "1:1")).toEqual({
			left: 500,
			top: 0,
			width: 1000,
			height: 1000,
		});
	});

	it("segue o ponto focal na horizontal", () => {
		// Rosto a um quarto da largura: o quadrado se centra nele (500 − 500 = 0).
		expect(
			focalCrop({ width: 2000, height: 1000 }, { x: 0.25, y: 0.5 }, "1:1").left,
		).toBe(0);
		expect(
			focalCrop({ width: 2000, height: 1000 }, { x: 0.6, y: 0.5 }, "1:1").left,
		).toBe(700);
	});

	it("com o ponto na borda, encosta na borda em vez de sair da imagem", () => {
		// O corte ingênuo centraria no ponto e pediria pixels que não existem.
		expect(
			focalCrop({ width: 2000, height: 1000 }, { x: 0, y: 0.5 }, "1:1").left,
		).toBe(0);
		expect(
			focalCrop({ width: 2000, height: 1000 }, { x: 1, y: 0.5 }, "1:1").left,
		).toBe(1000);
	});

	it("em foto em pé, corta na vertical, seguindo o ponto", () => {
		expect(
			focalCrop({ width: 1000, height: 3000 }, { x: 0.5, y: 0.2 }, "1:1"),
		).toEqual({ left: 0, top: 100, width: 1000, height: 1000 });
	});

	it("imagem já quadrada não é cortada", () => {
		expect(
			focalCrop({ width: 800, height: 800 }, { x: 0.9, y: 0.1 }, "1:1"),
		).toEqual({ left: 0, top: 0, width: 800, height: 800 });
	});
});

describe("focalCrop — 4:5", () => {
	it("em foto deitada, pega a faixa em pé mais alta que couber", () => {
		expect(focalCrop({ width: 2000, height: 1000 }, CENTRO, "4:5")).toEqual({
			left: 600,
			top: 0,
			width: 800,
			height: 1000,
		});
	});

	it("em foto muito alta, a largura inteira manda", () => {
		const box = focalCrop({ width: 1000, height: 4000 }, CENTRO, "4:5");
		expect(box.width).toBe(1000);
		expect(box.height).toBe(1250);
		expect(box.top).toBe(1375);
	});
});

describe("focalCrop — entradas estranhas", () => {
	it("ponto focal inválido cai no centro em vez de gerar NaN", () => {
		// NaN aqui chegaria ao `sharp` como coordenada e derrubaria a publicação.
		expect(
			focalCrop(
				{ width: 2000, height: 1000 },
				{ x: Number.NaN, y: Number.POSITIVE_INFINITY },
				"1:1",
			).left,
		).toBe(500);
	});

	it("ponto fora do quadrado unitário é trazido para dentro", () => {
		expect(
			focalCrop({ width: 2000, height: 1000 }, { x: 7, y: -3 }, "1:1").left,
		).toBe(1000);
	});

	it("nunca devolve dimensão zero, que o sharp recusa", () => {
		const box = focalCrop({ width: 1, height: 1 }, CENTRO, "4:5");
		expect(box.width).toBeGreaterThanOrEqual(1);
		expect(box.height).toBeGreaterThanOrEqual(1);
	});
});

describe("focalCropTo — proporção qualquer (spec 09)", () => {
	it("corta a caixa larga de um padrão, seguindo o ponto focal", () => {
		// Caixa 920×520 (a do cartão) numa foto 2000×2000: faixa deitada.
		expect(
			focalCropTo(
				{ width: 2000, height: 2000 },
				{ x: 0.5, y: 0.2 },
				{ width: 920, height: 520 },
			),
		).toEqual({ left: 0, top: 0, width: 2000, height: 1130 });
	});

	it("é o mesmo corte do focalCrop para as proporções conhecidas", () => {
		const imagem = { width: 1600, height: 900 };
		expect(focalCropTo(imagem, CENTRO, { width: 1080, height: 1350 })).toEqual(
			focalCrop(imagem, CENTRO, "4:5"),
		);
	});

	it("alvo com dimensão zero não gera divisão por zero", () => {
		const box = focalCropTo({ width: 100, height: 100 }, CENTRO, {
			width: 0,
			height: 0,
		});
		expect(box.width).toBeGreaterThanOrEqual(1);
		expect(box.height).toBeGreaterThanOrEqual(1);
	});
});

describe("croppedImageKey", () => {
	it("inclui mídia, proporção e ponto focal", () => {
		expect(croppedImageKey("m-1", "1:1", { x: 0.25, y: 0.75 })).toBe(
			"social/m-1-1x1-250-750.jpg",
		);
	});

	it("mudar o ponto focal muda a chave — senão a Meta receberia o corte velho", () => {
		expect(croppedImageKey("m-1", "1:1", CENTRO)).not.toBe(
			croppedImageKey("m-1", "1:1", { x: 0.3, y: 0.5 }),
		);
	});

	it("proporções diferentes não disputam o mesmo arquivo", () => {
		expect(croppedImageKey("m-1", "1:1", CENTRO)).not.toBe(
			croppedImageKey("m-1", "4:5", CENTRO),
		);
	});

	it("ponto inválido gera a mesma chave do centro", () => {
		expect(croppedImageKey("m-1", "1:1", { x: Number.NaN, y: 0.5 })).toBe(
			croppedImageKey("m-1", "1:1", CENTRO),
		);
	});
});
