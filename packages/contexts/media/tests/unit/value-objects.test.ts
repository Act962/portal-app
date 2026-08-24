import {
	AltText,
	Caption,
	Credit,
	Dimensions,
	FocalPoint,
	InvalidDimensions,
	InvalidFocalPoint,
	MissingAltText,
	MissingCredit,
} from "@portal-app/media";
import { describe, expect, it } from "vitest";

describe("Credit", () => {
	it("apara e aceita crédito não-vazio", () => {
		expect(Credit.create("  Foto: Ana  ").unwrap().value).toBe("Foto: Ana");
	});

	it("rejeita crédito vazio (MissingCredit)", () => {
		expect(Credit.create("   ").unwrapErr()).toBeInstanceOf(MissingCredit);
	});
});

describe("AltText", () => {
	it("apara e aceita texto não-vazio", () => {
		expect(AltText.create(" Torcida no estádio ").unwrap().value).toBe(
			"Torcida no estádio",
		);
	});

	it("rejeita texto vazio (MissingAltText)", () => {
		expect(AltText.create("").unwrapErr()).toBeInstanceOf(MissingAltText);
	});
});

describe("Caption", () => {
	it("apara e nunca falha; vazio é permitido", () => {
		expect(Caption.create("  legenda ").value).toBe("legenda");
		const empty = Caption.create();
		expect(empty.value).toBe("");
		expect(empty.isEmpty()).toBe(true);
	});
});

describe("Dimensions", () => {
	it("aceita inteiros positivos e calcula a razão de aspecto", () => {
		const dim = Dimensions.create(1600, 900).unwrap();
		expect(dim.width).toBe(1600);
		expect(dim.height).toBe(900);
		expect(dim.aspectRatio).toBeCloseTo(16 / 9);
	});

	it("rejeita zero, negativo ou fracionário (InvalidDimensions)", () => {
		expect(Dimensions.create(0, 100).unwrapErr()).toBeInstanceOf(
			InvalidDimensions,
		);
		expect(Dimensions.create(100, -1).unwrapErr()).toBeInstanceOf(
			InvalidDimensions,
		);
		expect(Dimensions.create(10.5, 100).unwrapErr()).toBeInstanceOf(
			InvalidDimensions,
		);
	});
});

describe("FocalPoint (M08)", () => {
	it("aceita coordenadas no quadrado unitário", () => {
		const fp = FocalPoint.create(0.25, 0.75).unwrap();
		expect(fp.x).toBe(0.25);
		expect(fp.y).toBe(0.75);
	});

	it("o centro é (0.5, 0.5)", () => {
		const c = FocalPoint.center();
		expect(c.x).toBe(0.5);
		expect(c.y).toBe(0.5);
	});

	it("rejeita fora de [0,1] ou não-finito (InvalidFocalPoint)", () => {
		expect(FocalPoint.create(-0.1, 0.5).unwrapErr()).toBeInstanceOf(
			InvalidFocalPoint,
		);
		expect(FocalPoint.create(0.5, 1.2).unwrapErr()).toBeInstanceOf(
			InvalidFocalPoint,
		);
		expect(FocalPoint.create(Number.NaN, 0.5).unwrapErr()).toBeInstanceOf(
			InvalidFocalPoint,
		);
	});
});
