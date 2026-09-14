import { existsSync } from "node:fs";
import { join } from "node:path";

import {
	type ArtContent,
	type ArtElement,
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	TEMPLATE_FONTS,
	type TemplateFontFamily,
} from "@portal-app/social";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
	ArtRenderer,
	findInNodeModules,
	fontFilePath,
	fontFilesFor,
} from "../../src/social-art";

const CRIADO = new Date("2026-09-14T12:00:00Z");

const MATERIA: ArtContent = {
	headline: "Estudantes de Piracuruca são premiados na OBMEP",
	subtitle: null,
	kicker: "Últimas",
	sectionName: "Educação",
	authorName: null,
	siteName: null,
	date: null,
};

const base = {
	name: "",
	rotation: 0,
	opacity: 1,
	visible: true,
	locked: false,
};

const foto: ArtElement = {
	...base,
	id: "foto",
	kind: "PHOTO",
	x: 0,
	y: 0,
	width: 1080,
	height: 1350,
	cornerRadius: 0,
	stroke: null,
};
const cartao: ArtElement = {
	...base,
	id: "cartao",
	kind: "RECT",
	x: 80,
	y: 430,
	width: 920,
	height: 520,
	fill: { type: "solid", color: "#d9232e" },
	cornerRadius: 48,
	stroke: null,
	shadow: null,
};
const moldura: ArtElement = {
	...base,
	id: "moldura",
	kind: "IMAGE",
	x: 0,
	y: 0,
	width: 1080,
	height: 200,
	mediaId: "media-moldura",
	fit: "stretch",
	cornerRadius: 0,
};
const titulo: ArtElement = {
	...base,
	id: "titulo",
	kind: "TEXT",
	x: 130,
	y: 560,
	width: 820,
	height: 260,
	mode: "EDITABLE",
	content: "{{titulo}}",
	fieldLabel: "Título",
	style: {
		...DEFAULT_TEXT_STYLE,
		fontWeight: 900,
		italic: true,
		color: "#ffe14d",
		uppercase: true,
		maxLines: 1,
		minFontSize: 60,
	},
};

function padrao(elements: readonly ArtElement[]) {
	return ArtTemplate.create({
		id: "tpl-1",
		name: "Últimas",
		format: "4:5",
		design: { background: "#ffffff", elements, variables: [] },
		createdAt: CRIADO,
	}).unwrap();
}

async function pixel(image: Buffer, x: number, y: number) {
	const { data, info } = await sharp(image)
		.raw()
		.toBuffer({ resolveWithObject: true });
	const offset = (y * info.width + x) * info.channels;
	return [data[offset], data[offset + 1], data[offset + 2]];
}

describe("fontes (10, D4)", () => {
	it("todo corte que o domínio promete existe no pacote de fontes", () => {
		// É a guarda contra o editor oferecer um peso que o servidor não desenha.
		for (const [family, spec] of Object.entries(TEMPLATE_FONTS)) {
			for (const weight of spec.weights) {
				for (const italic of spec.italic ? [false, true] : [false]) {
					expect(
						existsSync(
							fontFilePath(family as TemplateFontFamily, weight, italic),
						),
					).toBe(true);
				}
			}
		}
	});

	it("uma família registra cada peso, com e sem itálico", () => {
		expect(fontFilesFor("Montserrat")).toHaveLength(12);
		expect(fontFilesFor("Oswald")).toHaveLength(4);
	});
});

describe("findInNodeModules — sem require, para o bundler não enxergar", () => {
	const alvo = join("@fontsource", "poppins", "files", "poppins.woff");

	it("sobe as pastas a partir de cada ponto de partida até achar", () => {
		const existe = join("/repo/apps/web", "node_modules", alvo);
		expect(
			findInNodeModules(
				alvo,
				[join("/repo/packages/api/src"), join("/repo/apps/web/.next/server")],
				(caminho) => caminho === existe,
			),
		).toBe(existe);
	});

	it("o primeiro ponto de partida que acha vence", () => {
		const api = join("/repo/packages/api", "node_modules", alvo);
		const web = join("/repo/apps/web", "node_modules", alvo);
		expect(
			findInNodeModules(
				alvo,
				[join("/repo/packages/api/src"), join("/repo/apps/web")],
				(caminho) => caminho === api || caminho === web,
			),
		).toBe(api);
	});

	it("chega à raiz e desiste, devolvendo null", () => {
		expect(
			findInNodeModules(alvo, [join("/repo/a/b")], () => false),
		).toBeNull();
	});
});

describe("ArtRenderer (Konva + skia-canvas)", () => {
	async function fotoAzul() {
		return sharp({
			create: {
				width: 400,
				height: 300,
				channels: 3,
				background: { r: 0, g: 0, b: 220 },
			},
		})
			.png()
			.toBuffer();
	}

	function setup(options: {
		artExists?: boolean;
		photoStatus?: number;
		uploadStatus?: number;
		assets?: Record<string, object | null>;
	}) {
		const requests: { url: string; method: string }[] = [];
		const uploads: Uint8Array[] = [];
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			requests.push({ url, method });
			if (method === "HEAD") {
				return new Response(null, { status: options.artExists ? 200 : 404 });
			}
			if (method === "PUT") {
				uploads.push(init?.body as Uint8Array);
				return new Response(null, { status: options.uploadStatus ?? 200 });
			}
			if ((options.photoStatus ?? 200) !== 200) {
				return new Response(null, { status: options.photoStatus });
			}
			return new Response(new Uint8Array(await fotoAzul()));
		}) as typeof fetch;

		const assets: Record<string, object | null> = options.assets ?? {
			"foto-1": {
				id: "foto-1",
				storageKey: "2026/foto.png",
				mimeType: "image/png",
				altText: { value: "Estudantes com as medalhas" },
				focalPoint: { x: 0.5, y: 0.5 },
			},
		};

		const renderer = new ArtRenderer({
			media: { findById: async (id: string) => (assets[id] ?? null) as never },
			storage: {
				publicUrl: (key: string) => `https://cdn.test/${key}`,
				getUploadUrl: async (key: string) => `https://upload.test/${key}`,
				delete: async () => {},
			},
			fetch: fetchImpl,
		});
		return { renderer, requests, uploads };
	}

	const pedido = (overrides = {}) => ({
		template: padrao([foto, cartao, titulo]),
		photoMediaId: "foto-1",
		content: MATERIA,
		...overrides,
	});

	it("desenha, grava em JPEG na chave da arte e devolve o alt da foto", async () => {
		const { renderer, requests, uploads } = setup({});

		const arte = await renderer.publishable(pedido());

		expect(arte?.url).toMatch(
			/^https:\/\/cdn\.test\/social\/art\/tpl-1-v1-[0-9a-f]{16}\.jpg$/,
		);
		expect(arte?.altText).toBe("Estudantes com as medalhas");
		expect(requests.map((r) => r.method)).toEqual(["HEAD", "GET", "PUT"]);
		const gravada = await sharp(Buffer.from(uploads[0] ?? [])).metadata();
		expect(gravada.format).toBe("jpeg");
		expect(gravada.width).toBe(1080);
		expect(gravada.height).toBe(1350);
	}, 30_000);

	it("a foto é desenhada no lugar dela, e o cartão por cima", async () => {
		const { renderer, uploads } = setup({});
		await renderer.publishable(pedido());
		const arte = Buffer.from(uploads[0] ?? []);
		const [r, , b] = await pixel(arte, 20, 20);
		expect(b).toBeGreaterThan(180);
		expect(r).toBeLessThan(60);
		const [vermelho, verde] = await pixel(arte, 950, 900);
		expect(vermelho).toBeGreaterThan(190);
		expect(verde).toBeLessThan(70);
	}, 30_000);

	it("arte já gravada é reaproveitada — nada é desenhado de novo", async () => {
		const { renderer, requests } = setup({ artExists: true });
		await renderer.publishable(pedido());
		expect(requests.map((r) => r.method)).toEqual(["HEAD"]);
	});

	it("título trocado no post dá outra chave", async () => {
		const { renderer } = setup({ artExists: true });
		const a = await renderer.publishable(pedido());
		const b = await renderer.publishable(
			pedido({ inputs: { values: {}, texts: { titulo: "Outro título" } } }),
		);
		expect(a?.url).not.toBe(b?.url);
	});

	it("foto que não existe mais: null, sem desenhar", async () => {
		const { renderer, requests } = setup({ assets: {} });
		expect(await renderer.publishable(pedido())).toBeNull();
		expect(requests).toHaveLength(0);
	});

	it("padrão sem lugar de foto ignora a foto do post", async () => {
		const { renderer } = setup({ assets: {}, artExists: true });
		const arte = await renderer.publishable(
			pedido({ template: padrao([cartao, titulo]) }),
		);
		expect(arte?.altText).toBe("");
	});

	it("armazenamento instável LANÇA; falha ao gravar também", async () => {
		await expect(
			setup({ photoStatus: 503 }).renderer.publishable(pedido()),
		).rejects.toThrow("HTTP 503");
		await expect(
			setup({ uploadStatus: 500 }).renderer.publishable(pedido()),
		).rejects.toThrow("HTTP 500");
	}, 30_000);

	it("arquivo da foto apagado (404): a prévia desenha o lugar em cinza", async () => {
		const { renderer } = setup({ photoStatus: 404 });
		const png = await renderer.preview(pedido(), 540);
		expect(await pixel(png, 10, 10)).toEqual([156, 163, 175]);
	});

	it("arquivo da foto apagado (404): a arte publicada é null, sem gravar (spec 11, D10)", async () => {
		// Foi assim que um post saiu no Instagram com o cinza no lugar da foto.
		const { renderer, requests } = setup({ photoStatus: 404 });
		expect(await renderer.publishable(pedido())).toBeNull();
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
	}, 30_000);

	it("a prévia é o mesmo desenho reduzido, e não grava nada", async () => {
		const { renderer, requests } = setup({});
		const png = await renderer.preview(pedido());
		const meta = await sharp(png).metadata();
		expect(meta.width).toBe(540);
		expect(meta.height).toBe(675);
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
	});

	it("moldura entra no desenho; moldura inexistente é pulada", async () => {
		const assets = {
			"media-moldura": {
				id: "media-moldura",
				storageKey: "2026/moldura.png",
				mimeType: "image/png",
				altText: null,
				focalPoint: null,
			},
		};
		const { renderer } = setup({ assets });
		const png = await renderer.preview(
			pedido({ template: padrao([moldura]), photoMediaId: null }),
			1080,
		);
		const [, , b] = await pixel(png, 540, 100);
		expect(b).toBeGreaterThan(180);

		const semMoldura = await setup({ assets: {} }).renderer.preview(
			pedido({ template: padrao([moldura]), photoMediaId: null }),
			1080,
		);
		expect(await pixel(semMoldura, 540, 100)).toEqual([255, 255, 255]);
	});

	it("avisa o texto que não cabe nem no mínimo (D8)", async () => {
		const { renderer } = setup({});
		expect(await renderer.warnings(pedido())).toEqual([
			'"Título" não cabe nem no tamanho mínimo e vai sair cortado.',
		]);
		expect(
			await renderer.warnings(
				pedido({ inputs: { values: {}, texts: { titulo: "Curto" } } }),
			),
		).toEqual([]);
	});
});
