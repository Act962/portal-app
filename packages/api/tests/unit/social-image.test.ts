import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { CroppedImageSource, renderCrop } from "../../src/social-image";

/**
 * Uma imagem de verdade, gerada em memória: metade esquerda vermelha, metade
 * direita azul. Com ela dá para provar ONDE o corte caiu olhando a cor do pixel,
 * sem arquivo de fixture no repositório.
 */
async function halfRedHalfBlue(width = 400, height = 200): Promise<Buffer> {
	const half = Math.floor(width / 2);
	return sharp({
		create: {
			width,
			height,
			channels: 3,
			background: { r: 220, g: 0, b: 0 },
		},
	})
		.composite([
			{
				input: {
					create: {
						width: width - half,
						height,
						channels: 3,
						background: { r: 0, g: 0, b: 220 },
					},
				},
				left: half,
				top: 0,
			},
		])
		.png()
		.toBuffer();
}

async function centerPixel(jpeg: Buffer) {
	const { data, info } = await sharp(jpeg)
		.raw()
		.toBuffer({ resolveWithObject: true });
	const offset =
		(Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) *
		info.channels;
	return { r: data[offset] ?? 0, b: data[offset + 2] ?? 0 };
}

describe("renderCrop", () => {
	it("gera JPEG 1080×1080 a partir de uma foto deitada", async () => {
		const jpeg = await renderCrop(
			await halfRedHalfBlue(),
			{ x: 0.5, y: 0.5 },
			"1:1",
		);
		const meta = await sharp(jpeg).metadata();
		expect(meta.format).toBe("jpeg");
		expect(meta.width).toBe(1080);
		expect(meta.height).toBe(1080);
	});

	it("o ponto focal decide o lado: focal à esquerda sai vermelho", async () => {
		const jpeg = await renderCrop(
			await halfRedHalfBlue(),
			{ x: 0, y: 0.5 },
			"1:1",
		);
		const pixel = await centerPixel(jpeg);
		expect(pixel.r).toBeGreaterThan(150);
		expect(pixel.b).toBeLessThan(80);
	});

	it("focal à direita sai azul", async () => {
		const jpeg = await renderCrop(
			await halfRedHalfBlue(),
			{ x: 1, y: 0.5 },
			"1:1",
		);
		const pixel = await centerPixel(jpeg);
		expect(pixel.b).toBeGreaterThan(150);
		expect(pixel.r).toBeLessThan(80);
	});

	it("4:5 sai 1080×1350", async () => {
		const meta = await sharp(
			await renderCrop(await halfRedHalfBlue(), { x: 0.5, y: 0.5 }, "4:5"),
		).metadata();
		expect(meta.width).toBe(1080);
		expect(meta.height).toBe(1350);
	});

	it("PNG com transparência vira fundo branco, não preto", async () => {
		const transparent = await sharp({
			create: {
				width: 100,
				height: 100,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.png()
			.toBuffer();
		const pixel = await centerPixel(
			await renderCrop(transparent, { x: 0.5, y: 0.5 }, "1:1"),
		);
		expect(pixel.r).toBeGreaterThan(240);
		expect(pixel.b).toBeGreaterThan(240);
	});
});

describe("CroppedImageSource", () => {
	type Asset = {
		storageKey: string;
		mimeType: string;
		altText: { value: string } | null;
		focalPoint: { x: number; y: number } | null;
	};

	function setup(options: {
		asset: Asset | null;
		cropExists?: boolean;
		originalStatus?: number;
		uploadStatus?: number;
	}) {
		const requests: Array<{ url: string; method: string }> = [];
		const uploads: Uint8Array[] = [];
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			requests.push({ url, method });
			if (method === "HEAD") {
				return new Response(null, { status: options.cropExists ? 200 : 404 });
			}
			if (method === "PUT") {
				uploads.push(init?.body as Uint8Array);
				return new Response(null, { status: options.uploadStatus ?? 200 });
			}
			if ((options.originalStatus ?? 200) !== 200) {
				return new Response(null, { status: options.originalStatus });
			}
			return new Response(new Uint8Array(await halfRedHalfBlue()));
		}) as typeof fetch;

		const source = new CroppedImageSource({
			media: {
				findById: async () => options.asset,
			} as never,
			storage: {
				publicUrl: (key: string) => `https://cdn.test/${key}`,
				getUploadUrl: async (key: string) => `https://upload.test/${key}`,
				delete: async () => {},
			},
			fetch: fetchImpl,
		});
		return { source, requests, uploads };
	}

	const foto: Asset = {
		storageKey: "2026/capa.png",
		mimeType: "image/png",
		altText: { value: "Rua alagada" },
		focalPoint: { x: 0.25, y: 0.5 },
	};

	it("corta, sobe e devolve a URL pública do corte", async () => {
		const { source, requests, uploads } = setup({ asset: foto });

		const image = await source.resolve("m-1", "1:1");

		expect(image).toEqual({
			url: "https://cdn.test/social/m-1-1x1-250-500.jpg",
			altText: "Rua alagada",
		});
		expect(requests.map((r) => r.method)).toEqual(["HEAD", "GET", "PUT"]);
		expect(requests[1]?.url).toBe("https://cdn.test/2026/capa.png");
		expect((await sharp(Buffer.from(uploads[0] ?? [])).metadata()).format).toBe(
			"jpeg",
		);
	});

	it("corte que já existe é reaproveitado — reenviar não refaz o trabalho", async () => {
		const { source, requests } = setup({ asset: foto, cropExists: true });
		await source.resolve("m-1", "1:1");
		expect(requests.map((r) => r.method)).toEqual(["HEAD"]);
	});

	it("sem ponto focal, corta pelo centro", async () => {
		const { source } = setup({ asset: { ...foto, focalPoint: null } });
		expect((await source.resolve("m-1", "1:1"))?.url).toBe(
			"https://cdn.test/social/m-1-1x1-500-500.jpg",
		);
	});

	it("'original' devolve o arquivo sem cortar e sem chamar nada", async () => {
		const { source, requests } = setup({ asset: foto });
		expect(await source.resolve("m-1", "original")).toEqual({
			url: "https://cdn.test/2026/capa.png",
			altText: "Rua alagada",
		});
		expect(requests).toHaveLength(0);
	});

	it("mídia inexistente ou que não é imagem devolve null", async () => {
		expect(await setup({ asset: null }).source.resolve("x", "1:1")).toBeNull();
		expect(
			await setup({
				asset: { ...foto, mimeType: "application/pdf" },
			}).source.resolve("x", "1:1"),
		).toBeNull();
	});

	it("arquivo apagado do armazenamento (404) devolve null — é definitivo", async () => {
		const { source } = setup({ asset: foto, originalStatus: 404 });
		expect(await source.resolve("m-1", "1:1")).toBeNull();
	});

	it("armazenamento instável LANÇA — a entrega fica pendente para a próxima rodada", async () => {
		// `null` aqui viraria "a imagem não existe mais", erro definitivo gravado na
		// entrega. Um 503 é passageiro.
		const { source } = setup({ asset: foto, originalStatus: 503 });
		await expect(source.resolve("m-1", "1:1")).rejects.toThrow("HTTP 503");
	});

	it("falha ao gravar o corte LANÇA", async () => {
		const { source } = setup({ asset: foto, uploadStatus: 500 });
		await expect(source.resolve("m-1", "1:1")).rejects.toThrow("HTTP 500");
	});

	it("sem alt, devolve alt vazio em vez de null", async () => {
		const { source } = setup({
			asset: { ...foto, altText: null },
			cropExists: true,
		});
		expect((await source.resolve("m-1", "1:1"))?.altText).toBe("");
	});
});
