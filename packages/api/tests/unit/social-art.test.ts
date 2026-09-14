import { existsSync } from "node:fs";
import { join } from "node:path";

import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	TEMPLATE_FONTS,
	type TemplateFontFamily,
	type TemplateLayer,
} from "@portal-app/social";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
	ArtRenderer,
	buildArtTree,
	findInNodeModules,
	fontFilePath,
	fontsFor,
	PHOTO_PLACEHOLDER,
	renderArtPng,
	resolveTexts,
} from "../../src/social-art";

const CRIADO = new Date("2026-09-14T12:00:00Z");

const MATERIA = {
	headline: "Estudantes de Piracuruca são premiados na OBMEP",
	kicker: "Últimas",
	sectionName: "Educação",
};

const foto: TemplateLayer = {
	id: "foto",
	kind: "PHOTO",
	box: { x: 0, y: 0, width: 1080, height: 1350 },
};
const cartao: TemplateLayer = {
	id: "cartao",
	kind: "SHAPE",
	box: { x: 80, y: 430, width: 920, height: 520 },
	color: "#d9232e",
	radius: 48,
	opacity: 1,
};
const moldura: TemplateLayer = {
	id: "moldura",
	kind: "IMAGE",
	box: { x: 0, y: 0, width: 1080, height: 200 },
	mediaId: "media-moldura",
	fit: "cover",
};
const chapeu: TemplateLayer = {
	id: "chapeu",
	kind: "TEXT",
	box: { x: 110, y: 460, width: 300, height: 70 },
	source: "KICKER",
	text: "",
	style: {
		...DEFAULT_TEXT_STYLE,
		fontSize: 36,
		minFontSize: 20,
		color: "#d9232e",
		uppercase: true,
		maxLines: 1,
		background: { color: "#ffffff", radius: 35, paddingX: 24, paddingY: 8 },
	},
};
const titulo: TemplateLayer = {
	id: "titulo",
	kind: "TEXT",
	box: { x: 130, y: 560, width: 820, height: 260 },
	source: "HEADLINE",
	text: "",
	style: {
		...DEFAULT_TEXT_STYLE,
		fontWeight: 900,
		italic: true,
		color: "#ffe14d",
		uppercase: true,
	},
};

function padrao(layers: readonly TemplateLayer[]) {
	return ArtTemplate.create({
		id: "tpl-1",
		name: "Últimas",
		format: "4:5",
		layers,
		createdAt: CRIADO,
	}).unwrap();
}

async function pixel(png: Buffer, x: number, y: number) {
	const { data, info } = await sharp(png)
		.raw()
		.toBuffer({ resolveWithObject: true });
	const offset = (y * info.width + x) * info.channels;
	return [data[offset], data[offset + 1], data[offset + 2]];
}

describe("fontes (D6)", () => {
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

	it("carrega só os cortes usados, mais o de reserva", async () => {
		const fontes = await fontsFor(padrao([chapeu, titulo]));
		expect(
			fontes.map((f) => `${f.name}:${f.weight}:${f.style}`).sort(),
		).toEqual([
			"Montserrat:400:normal",
			"Montserrat:800:normal",
			"Montserrat:900:italic",
		]);
		expect(fontes.every((f) => f.data.length > 1000)).toBe(true);
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

describe("resolveTexts", () => {
	it("texto e tamanho de cada caixa, com caixa-alta e troca no post", () => {
		const textos = resolveTexts(padrao([chapeu, titulo]), MATERIA, {
			titulo: "Curto",
		});
		expect(textos.chapeu?.text).toBe("ÚLTIMAS");
		expect(textos.titulo).toEqual({ text: "CURTO", fontSize: 64 });
	});
});

describe("buildArtTree", () => {
	const entradas = {
		photo: "data:image/jpeg;base64,AAAA",
		images: { moldura: "data:image/png;base64,BBBB" },
		texts: {
			chapeu: { text: "ÚLTIMAS", fontSize: 36 },
			titulo: { text: "TÍTULO", fontSize: 58 },
		},
	};

	it("um quadro do formato, com as camadas NA ORDEM da pilha", () => {
		const arvore = buildArtTree(
			padrao([foto, cartao, moldura, chapeu, titulo]),
			entradas,
		);
		expect(arvore.props.style).toMatchObject({ width: 1080, height: 1350 });
		const filhos = arvore.props.children as { type: string }[];
		expect(filhos.map((f) => f.type)).toEqual([
			"img",
			"div",
			"img",
			"div",
			"div",
		]);
	});

	it("posição absoluta arredondada, e o tamanho escolhido no texto", () => {
		const arvore = buildArtTree(
			padrao([
				{ ...cartao, box: { x: 80.4, y: 429.6, width: 920.2, height: 1.4 } },
				titulo,
			]),
			entradas,
		);
		const [forma, texto] = arvore.props.children as {
			props: {
				style: Record<string, unknown>;
				children: { props: { children: { props: { style: object } }[] } }[];
			};
		}[];
		expect(forma?.props.style).toMatchObject({
			position: "absolute",
			left: 80,
			top: 430,
			width: 920,
			height: 1,
		});
		const estilo = texto?.props.children[0]?.props.children[0]?.props.style;
		expect(estilo).toMatchObject({
			fontSize: 58,
			fontWeight: 900,
			fontStyle: "italic",
			lineClamp: 4,
		});
	});

	it("caixa de texto vazia e moldura ausente não desenham nada", () => {
		const arvore = buildArtTree(padrao([moldura, chapeu, titulo]), {
			photo: null,
			images: {},
			texts: {
				chapeu: { text: "", fontSize: 36 },
				titulo: entradas.texts.titulo,
			},
		});
		expect(arvore.props.children).toHaveLength(1);
	});

	it("sem foto, o lugar da foto sai em cinza", () => {
		const arvore = buildArtTree(padrao([foto]), {
			photo: null,
			images: {},
			texts: {},
		});
		const [lugar] = arvore.props.children as {
			type: string;
			props: { style: object };
		}[];
		expect(lugar?.type).toBe("div");
		expect(lugar?.props.style).toMatchObject({
			backgroundColor: PHOTO_PLACEHOLDER,
		});
	});
});

describe("renderArtPng", () => {
	it("desenha o quadro inteiro, com cada camada no lugar", async () => {
		const template = padrao([foto, cartao, chapeu, titulo]);
		const png = await renderArtPng(template, {
			photo: null,
			images: {},
			texts: resolveTexts(template, MATERIA),
		});

		const meta = await sharp(png).metadata();
		expect(meta.width).toBe(1080);
		expect(meta.height).toBe(1350);
		// Fora do cartão, o cinza do lugar da foto; dentro, o vermelho do cartão.
		expect(await pixel(png, 20, 20)).toEqual([156, 163, 175]);
		expect(await pixel(png, 950, 900)).toEqual([217, 35, 46]);
	});

	it("a prévia é o mesmo desenho, reduzido", async () => {
		const template = padrao([cartao]);
		const png = await renderArtPng(
			template,
			{ photo: null, images: {}, texts: {} },
			{ width: 540 },
		);
		const meta = await sharp(png).metadata();
		expect(meta.width).toBe(540);
		expect(meta.height).toBe(675);
		expect(await pixel(png, 475, 450)).toEqual([217, 35, 46]);
	});
});

describe("ArtRenderer", () => {
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
	});

	it("a foto é desenhada no lugar dela", async () => {
		const { renderer, uploads } = setup({});
		await renderer.publishable(pedido());
		const [r, , b] = await pixel(Buffer.from(uploads[0] ?? []), 20, 20);
		expect(b).toBeGreaterThan(180);
		expect(r).toBeLessThan(60);
	});

	it("arte já gravada é reaproveitada — nada é desenhado de novo", async () => {
		const { renderer, requests } = setup({ artExists: true });
		await renderer.publishable(pedido());
		expect(requests.map((r) => r.method)).toEqual(["HEAD"]);
	});

	it("título diferente dá outra chave", async () => {
		const { renderer } = setup({ artExists: true });
		const a = await renderer.publishable(pedido());
		const b = await renderer.publishable(
			pedido({ overrides: { titulo: "Outro título" } }),
		);
		expect(a?.url).not.toBe(b?.url);
	});

	it("foto que não existe mais: null, sem desenhar", async () => {
		const { renderer, requests } = setup({ assets: {} });
		expect(await renderer.publishable(pedido())).toBeNull();
		expect(requests).toHaveLength(0);
	});

	it("padrão sem camada de foto ignora a foto do post", async () => {
		const { renderer } = setup({ assets: {} });
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
	});

	it("arquivo da foto apagado (404) desenha o lugar em cinza", async () => {
		const { renderer } = setup({ photoStatus: 404 });
		const png = await renderer.preview(pedido(), 540);
		expect(await pixel(png, 10, 10)).toEqual([156, 163, 175]);
	});

	it("a prévia não grava nada", async () => {
		const { renderer, requests } = setup({});
		const png = await renderer.preview(pedido());
		expect((await sharp(png).metadata()).width).toBe(540);
		expect(requests.some((r) => r.method === "PUT")).toBe(false);
	});

	it("moldura com transparência entra no desenho; moldura inexistente é pulada", async () => {
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
		// A "moldura" do fake é a foto azul, esticada na faixa de cima.
		const [, , b] = await pixel(png, 540, 100);
		expect(b).toBeGreaterThan(180);

		const semMoldura = await setup({ assets: {} }).renderer.preview(
			pedido({ template: padrao([moldura]), photoMediaId: null }),
			1080,
		);
		expect(await pixel(semMoldura, 540, 100)).toEqual([255, 255, 255]);
	});
});
