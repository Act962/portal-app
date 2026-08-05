import {
	InvalidDimensions,
	InvalidFocalPoint,
	MediaAsset,
	MissingAltText,
	MissingCredit,
	MissingDimensions,
} from "@portal-app/media";
import { describe, expect, it } from "vitest";

const imageInput = {
	id: "asset-1",
	type: "IMAGE" as const,
	storageKey: "2026/08/foto.jpg",
	filename: "foto.jpg",
	mimeType: "image/jpeg",
	credit: "Foto: Ana Paula",
	altText: "Torcida no estádio",
	dimensions: { width: 1600, height: 900 },
};

describe("MediaAsset — invariantes A29", () => {
	it("cria uma imagem completa com todos os metadados", () => {
		const asset = MediaAsset.create({
			...imageInput,
			caption: "Final do campeonato",
			focalPoint: { x: 0.4, y: 0.3 },
		}).unwrap();

		expect(asset.isImage()).toBe(true);
		expect(asset.type).toBe("IMAGE");
		expect(asset.credit.value).toBe("Foto: Ana Paula");
		expect(asset.altText?.value).toBe("Torcida no estádio");
		expect(asset.dimensions?.width).toBe(1600);
		expect(asset.caption.value).toBe("Final do campeonato");
		expect(asset.focalPoint?.x).toBe(0.4);
		expect(asset.storageKey).toBe("2026/08/foto.jpg");
	});

	it("M06: rejeita asset sem crédito (MissingCredit)", () => {
		expect(MediaAsset.create({ ...imageInput, credit: "  " }).unwrapErr()).toBeInstanceOf(
			MissingCredit,
		);
	});

	it("M07: imagem sem alt-text é rejeitada (MissingAltText)", () => {
		expect(MediaAsset.create({ ...imageInput, altText: "" }).unwrapErr()).toBeInstanceOf(
			MissingAltText,
		);
	});

	it("M07: imagem sem dimensões é rejeitada (MissingDimensions)", () => {
		expect(
			MediaAsset.create({ ...imageInput, dimensions: null }).unwrapErr(),
		).toBeInstanceOf(MissingDimensions);
	});

	it("propaga erro de dimensões inválidas", () => {
		expect(
			MediaAsset.create({ ...imageInput, dimensions: { width: 0, height: 900 } }).unwrapErr(),
		).toBeInstanceOf(InvalidDimensions);
	});

	it("propaga erro de ponto focal inválido", () => {
		expect(
			MediaAsset.create({ ...imageInput, focalPoint: { x: 2, y: 0 } }).unwrapErr(),
		).toBeInstanceOf(InvalidFocalPoint);
	});

	it("um documento dispensa alt-text e dimensões, mas exige crédito", () => {
		const doc = MediaAsset.create({
			id: "doc-1",
			type: "DOCUMENT",
			storageKey: "2026/08/edital.pdf",
			filename: "edital.pdf",
			mimeType: "application/pdf",
			credit: "Prefeitura",
		}).unwrap();

		expect(doc.isImage()).toBe(false);
		expect(doc.altText).toBeNull();
		expect(doc.dimensions).toBeNull();
		expect(doc.focalPoint).toBeNull();
		expect(doc.caption.isEmpty()).toBe(true);
	});
});

describe("MediaAsset — reidratação", () => {
	it("restaura de dados persistidos", () => {
		const asset = MediaAsset.restore(imageInput);

		expect(asset.filename).toBe("foto.jpg");
		expect(asset.mimeType).toBe("image/jpeg");
	});

	it("estoura ao restaurar dados que violam o invariante", () => {
		expect(() => MediaAsset.restore({ ...imageInput, credit: "" })).toThrow(MissingCredit);
	});
});
