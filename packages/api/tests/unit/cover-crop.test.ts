import { describe, expect, it } from "vitest";
import { coverCrop } from "../../src/cover-crop";

describe("recorte da capa", () => {
	it("preserva uma imagem 16:9 sem ampliação", () => {
		expect(coverCrop(1600, 900, 0.5, 0.5, 1)).toEqual({
			left: 0,
			top: 0,
			width: 1600,
			height: 900,
		});
	});
	it("permite enquadrar a parte inferior de uma foto vertical", () => {
		expect(coverCrop(900, 1600, 0.5, 1, 1)).toEqual({
			left: 0,
			top: 1094,
			width: 900,
			height: 506,
		});
	});
	it("amplia e desloca até o canto sem sair da imagem", () => {
		expect(coverCrop(1600, 900, 1, 1, 2)).toEqual({
			left: 800,
			top: 450,
			width: 800,
			height: 450,
		});
	});
	it("recorta um quadrado de um retrato, seguindo a posição vertical", () => {
		expect(coverCrop(961, 1280, 0.5, 0, 1, "1:1")).toEqual({
			left: 0,
			top: 0,
			width: 961,
			height: 961,
		});
		expect(coverCrop(961, 1280, 0.5, 1, 1, "1:1").top).toBe(319);
	});
	it("recorta um quadrado de uma foto deitada, com ampliação", () => {
		expect(coverCrop(1600, 900, 0.5, 0.5, 2, "1:1")).toEqual({
			left: 575,
			top: 225,
			width: 450,
			height: 450,
		});
	});
});
