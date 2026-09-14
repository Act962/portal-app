import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { MediaRepository, MediaStorage } from "@portal-app/media";
import {
	type ArtContent,
	type ArtTemplate,
	artImageKey,
	type Box,
	fitText,
	focalCropTo,
	type PublishableImage,
	type TemplateFontFamily,
	type TemplateLayer,
	type TextLayer,
	type TextOverrides,
	textForLayer,
} from "@portal-app/social";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";

/**
 * O desenhista dos padrões de arte (spec 09, F3).
 *
 * Mora na raiz de composição pelo mesmo motivo do `CroppedImageSource`: precisa
 * da MÍDIA (a foto, a moldura) e de bibliotecas nativas — nada disso cabe num
 * contexto cujo domínio não tem dependência.
 *
 * Três partes, separadas de propósito:
 *
 * 1. **`resolveTexts` e `buildArtTree` são puras.** Dado o padrão e as entradas
 *    já resolvidas, devolvem o texto de cada caixa e a árvore que o Satori
 *    desenha. É onde mora o que pode errar em silêncio (camada fora de ordem,
 *    caixa vazia desenhada como pílula sem texto), e se prova sem arquivo nem
 *    rede.
 * 2. **`renderArtPng` desenha**: Satori (layout e texto em curvas) + resvg
 *    (rasterização). Não usa o `next/og` — ver spec 09, D5.
 * 3. **`ArtRenderer` busca e guarda**: baixa foto e moldura, corta a foto no
 *    ponto focal, e — para publicar — grava o JPEG no armazenamento numa chave
 *    que é cache (D8).
 */

// ── fontes (D6) ─────────────────────────────────────────────────────────────

const FONT_SLUG: Record<TemplateFontFamily, string> = {
	Montserrat: "montserrat",
	Poppins: "poppins",
	"Nunito Sans": "nunito-sans",
	Oswald: "oswald",
	Lora: "lora",
};

/**
 * Procura `node_modules/<relativo>` subindo as pastas a partir de cada ponto de
 * partida, na ordem. `null` quando não acha em lugar nenhum.
 *
 * **Sem `require` nenhum, de propósito.** O Turbopack analisa no build toda
 * resolução de módulo — inclusive o `.resolve` de um `createRequire`, e mesmo
 * com `turbopackIgnore` — e, com caminho dinâmico, tenta casá-lo com o
 * `exports` do `@fontsource`, não consegue ("complex patterns into wildcard
 * exports") e derruba a rota inteira com "module not found". E um caminho
 * literal também não serviria: dentro do bundle, `require.resolve` devolve um
 * id de módulo, não um arquivo que o `readFile` abra. Checar a existência de um
 * caminho é só sistema de arquivos — não há o que o bundler analisar.
 */
export function findInNodeModules(
	relative: string,
	anchors: readonly string[],
	exists: (path: string) => boolean = existsSync,
): string | null {
	for (const anchor of anchors) {
		let dir = anchor;
		let previous = "";
		while (dir !== previous) {
			const candidate = join(dir, "node_modules", relative);
			if (exists(candidate)) {
				return candidate;
			}
			previous = dir;
			dir = dirname(dir);
		}
	}
	return null;
}

/**
 * De onde a busca parte: do arquivo em execução (nos testes, `packages/api`;
 * no servidor, o código do `.next` de `apps/web`) e da pasta de trabalho do
 * processo. As fontes são dependência dos DOIS pacotes por isso — com o pnpm,
 * cada um só enxerga o próprio `node_modules`.
 */
const FONT_ANCHORS = [dirname(fileURLToPath(import.meta.url)), process.cwd()];

/** O arquivo de um corte de fonte no pacote `@fontsource` da família. */
export function fontFilePath(
	family: TemplateFontFamily,
	weight: number,
	italic: boolean,
): string {
	const slug = FONT_SLUG[family];
	const relative = join(
		"@fontsource",
		slug,
		"files",
		`${slug}-latin-${weight}-${italic ? "italic" : "normal"}.woff`,
	);
	const found = findInNodeModules(relative, FONT_ANCHORS);
	if (!found) {
		throw new Error(
			`A fonte ${family} ${weight}${italic ? " itálico" : ""} não foi encontrada (${relative}).`,
		);
	}
	return found;
}

type SatoriWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type SatoriFont = {
	name: string;
	data: Buffer;
	weight: SatoriWeight;
	style: "normal" | "italic";
};

const fontCache = new Map<string, Promise<Buffer>>();

function loadFont(
	family: TemplateFontFamily,
	weight: number,
	italic: boolean,
): Promise<Buffer> {
	const key = `${family}:${weight}:${italic}`;
	let font = fontCache.get(key);
	if (!font) {
		font = readFile(fontFilePath(family, weight, italic));
		fontCache.set(key, font);
	}
	return font;
}

/**
 * Só os cortes que o padrão usa — cada arquivo tem dezenas de KB, e o Satori
 * processa todos que recebe. Um corte fixo sempre vai junto porque o Satori se
 * recusa a desenhar sem fonte nenhuma (padrão só de imagens).
 */
export async function fontsFor(template: ArtTemplate): Promise<SatoriFont[]> {
	const cuts = new Map<
		string,
		{ family: TemplateFontFamily; weight: number; italic: boolean }
	>();
	cuts.set("fallback", { family: "Montserrat", weight: 400, italic: false });
	for (const layer of template.textLayers) {
		const { fontFamily, fontWeight, italic } = layer.style;
		cuts.set(`${fontFamily}:${fontWeight}:${italic}`, {
			family: fontFamily,
			weight: fontWeight,
			italic,
		});
	}
	return Promise.all(
		[...cuts.values()].map(async (cut) => ({
			name: cut.family,
			data: await loadFont(cut.family, cut.weight, cut.italic),
			weight: cut.weight as SatoriWeight,
			style: cut.italic ? ("italic" as const) : ("normal" as const),
		})),
	);
}

// ── partes puras ────────────────────────────────────────────────────────────

export type ResolvedText = { text: string; fontSize: number };

export type ArtInputs = {
	/** A foto já cortada no tamanho da caixa, como data URI. `null` desenha o
	 * lugar da foto em cinza — é o que a prévia do padrão mostra sem foto. */
	photo: string | null;
	/** Molduras e logos, por id da camada, como data URI. */
	images: Readonly<Record<string, string>>;
	/** O texto final e o tamanho escolhido, por id da camada. */
	texts: Readonly<Record<string, ResolvedText>>;
};

/** O texto de cada caixa e o tamanho que cabe (D7). */
export function resolveTexts(
	template: ArtTemplate,
	content: ArtContent,
	overrides: TextOverrides = {},
): Record<string, ResolvedText> {
	return Object.fromEntries(
		template.textLayers.map((layer) => {
			const text = textForLayer(layer, content, overrides);
			return [layer.id, { text, fontSize: fitText(text, layer).fontSize }];
		}),
	);
}

export type ArtNode = {
	type: string;
	props: Record<string, unknown> & { children?: ArtNode[] | string };
};

/** O cinza do lugar da foto, quando ainda não há foto. */
export const PHOTO_PLACEHOLDER = "#9ca3af";

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" };
const ALIGN = { left: "flex-start", center: "center", right: "flex-end" };

/**
 * A árvore que o Satori desenha: um quadro do tamanho do formato e, dentro dele,
 * cada camada em posição absoluta, NA ORDEM da pilha — a primeira fica embaixo.
 */
export function buildArtTree(
	template: ArtTemplate,
	inputs: ArtInputs,
): ArtNode {
	const { width, height } = template.canvas;
	return node(
		"div",
		{
			style: {
				width,
				height,
				display: "flex",
				position: "relative",
				// JPEG não tem transparência: o fundo branco é o que evita o preto
				// onde nenhuma camada cobre.
				backgroundColor: "#ffffff",
			},
		},
		template.layers.flatMap((layer) => layerNodes(layer, inputs)),
	);
}

function layerNodes(layer: TemplateLayer, inputs: ArtInputs): ArtNode[] {
	switch (layer.kind) {
		case "PHOTO":
			return [
				inputs.photo
					? imageNode(inputs.photo, layer.box)
					: node("div", {
							style: {
								...positioned(layer.box),
								display: "flex",
								backgroundColor: PHOTO_PLACEHOLDER,
							},
						}),
			];
		case "IMAGE": {
			const src = inputs.images[layer.id];
			return src ? [imageNode(src, layer.box)] : [];
		}
		case "SHAPE":
			return [
				node("div", {
					style: {
						...positioned(layer.box),
						display: "flex",
						backgroundColor: layer.color,
						borderRadius: layer.radius,
						opacity: layer.opacity,
					},
				}),
			];
		case "TEXT": {
			const resolved = inputs.texts[layer.id];
			// Caixa sem texto não desenha nada — senão o chapéu apagado no post
			// deixaria uma pílula branca vazia na arte.
			return resolved && resolved.text !== ""
				? [textNode(layer, resolved)]
				: [];
		}
	}
}

function textNode(layer: TextLayer, resolved: ResolvedText): ArtNode {
	const { style } = layer;
	const background = style.background;
	return node(
		"div",
		{
			style: {
				...positioned(layer.box),
				display: "flex",
				flexDirection: "column",
				justifyContent: JUSTIFY[style.verticalAlign],
				alignItems: ALIGN[style.align],
			},
		},
		[
			node(
				"div",
				{
					style: {
						display: "flex",
						maxWidth: "100%",
						...(background
							? {
									backgroundColor: background.color,
									borderRadius: background.radius,
									paddingLeft: background.paddingX,
									paddingRight: background.paddingX,
									paddingTop: background.paddingY,
									paddingBottom: background.paddingY,
								}
							: {}),
					},
				},
				[
					node(
						"div",
						{
							style: {
								display: "block",
								fontFamily: style.fontFamily,
								fontWeight: style.fontWeight,
								fontStyle: style.italic ? "italic" : "normal",
								fontSize: resolved.fontSize,
								lineHeight: style.lineHeight,
								color: style.color,
								textAlign: style.align,
								whiteSpace: "pre-wrap",
								lineClamp: style.maxLines,
							},
						},
						resolved.text,
					),
				],
			),
		],
	);
}

function imageNode(src: string, box: Box): ArtNode {
	const style = positioned(box);
	return node("img", { src, width: style.width, height: style.height, style });
}

function positioned(box: Box) {
	return {
		position: "absolute",
		left: Math.round(box.x),
		top: Math.round(box.y),
		width: Math.max(1, Math.round(box.width)),
		height: Math.max(1, Math.round(box.height)),
	};
}

function node(
	type: string,
	props: Record<string, unknown>,
	children?: ArtNode[] | string,
): ArtNode {
	return {
		type,
		props: children === undefined ? props : { ...props, children },
	};
}

// ── desenho ─────────────────────────────────────────────────────────────────

/**
 * Desenha o PNG. `width` menor que o quadro é a prévia — o mesmo desenho,
 * reduzido na rasterização, e não um layout diferente.
 */
export async function renderArtPng(
	template: ArtTemplate,
	inputs: ArtInputs,
	options: { width?: number } = {},
): Promise<Buffer> {
	const { width, height } = template.canvas;
	const svg = await satori(buildArtTree(template, inputs) as never, {
		width,
		height,
		fonts: await fontsFor(template),
	});
	// O Satori entrega o texto já em curvas: o resvg não precisa de fonte
	// nenhuma, e desligar as do sistema é o que torna o resultado igual em
	// qualquer servidor.
	const png = new Resvg(svg, {
		fitTo: { mode: "width", value: options.width ?? width },
		font: { loadSystemFonts: false },
	})
		.render()
		.asPng();
	return Buffer.from(png);
}

// ── busca e cache ───────────────────────────────────────────────────────────

export type ArtRequest = {
	template: ArtTemplate;
	/** A foto do post. `null` com camada de foto desenha o lugar em cinza. */
	photoMediaId: string | null;
	content: ArtContent;
	overrides?: TextOverrides;
};

type PhotoAsset = {
	id: string;
	storageKey: string;
	mimeType: string;
	altText: { value: string } | null;
	focalPoint: { x: number; y: number } | null;
};

/**
 * Resolve as entradas do desenho e o desenha — para a prévia (PNG na hora) ou
 * para publicar (JPEG no armazenamento, com cache pela chave — D8).
 *
 * Falha de rede LANÇA, como no `CroppedImageSource`: armazenamento instável é
 * passageiro, e a entrega fica pendente para a próxima rodada. Arquivo que não
 * existe mais (404) não lança: a foto vira `null` e a moldura some do desenho.
 */
export class ArtRenderer {
	private readonly fetchImpl: typeof fetch;

	constructor(
		private readonly deps: {
			media: Pick<MediaRepository, "findById">;
			storage: MediaStorage;
			fetch?: typeof fetch;
		},
	) {
		this.fetchImpl = deps.fetch ?? fetch;
	}

	/** A prévia do editor: PNG reduzido, nada gravado. */
	async preview(request: ArtRequest, width = 540): Promise<Buffer> {
		const photo = await this.photoAsset(request);
		const inputs = await this.inputs(request, photo);
		return renderArtPng(request.template, inputs, { width });
	}

	/**
	 * A arte que vai ao ar, no armazenamento. `null` quando o post pede foto e a
	 * foto não é imagem ou não existe mais — erro definitivo para a entrega.
	 */
	async publishable(request: ArtRequest): Promise<PublishableImage | null> {
		const { template } = request;
		const photo = await this.photoAsset(request);
		if (template.photoLayer && request.photoMediaId && !photo) {
			return null;
		}

		const texts = resolveTexts(template, request.content, request.overrides);
		const key = artImageKey({
			templateId: template.id,
			templateVersion: template.version,
			photo: photo
				? { mediaId: photo.id, focal: photo.focalPoint ?? CENTER }
				: null,
			texts: Object.fromEntries(
				Object.entries(texts).map(([id, resolved]) => [id, resolved.text]),
			),
			images: Object.fromEntries(
				template.layers.flatMap((layer) =>
					layer.kind === "IMAGE" ? [[layer.id, layer.mediaId]] : [],
				),
			),
		});
		const url = this.deps.storage.publicUrl(key);
		const altText = photo?.altText?.value ?? "";

		if (await this.exists(url)) {
			return { url, altText };
		}

		const png = await renderArtPng(template, await this.inputs(request, photo));
		const jpeg = await sharp(png)
			.flatten({ background: "#ffffff" })
			.jpeg({ quality: 90, mozjpeg: true })
			.toBuffer();

		const uploadUrl = await this.deps.storage.getUploadUrl(key, "image/jpeg");
		const upload = await this.fetchImpl(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "image/jpeg" },
			body: new Uint8Array(jpeg),
		});
		if (!upload.ok) {
			throw new Error(
				`Não foi possível gravar a arte do padrão "${template.name}" (HTTP ${upload.status}).`,
			);
		}
		return { url, altText };
	}

	private async photoAsset(request: ArtRequest): Promise<PhotoAsset | null> {
		if (!request.template.photoLayer || !request.photoMediaId) {
			return null;
		}
		const asset = (await this.deps.media.findById(
			request.photoMediaId,
		)) as PhotoAsset | null;
		return asset?.mimeType.startsWith("image/") ? asset : null;
	}

	private async inputs(
		request: ArtRequest,
		photo: PhotoAsset | null,
	): Promise<ArtInputs> {
		const { template } = request;
		const photoLayer = template.photoLayer;

		const [photoUri, images] = await Promise.all([
			photo && photoLayer ? this.croppedPhoto(photo, photoLayer.box) : null,
			Promise.all(
				template.layers.flatMap((layer) =>
					layer.kind === "IMAGE"
						? [
								this.fittedImage(layer.mediaId, layer.box, layer.fit).then(
									(uri) => [layer.id, uri] as const,
								),
							]
						: [],
				),
			),
		]);

		return {
			photo: photoUri,
			images: Object.fromEntries(
				images.filter((entry): entry is readonly [string, string] =>
					Boolean(entry[1]),
				),
			),
			texts: resolveTexts(template, request.content, request.overrides),
		};
	}

	/** A foto cortada na proporção da caixa, seguindo o ponto focal. */
	private async croppedPhoto(
		asset: PhotoAsset,
		box: Box,
	): Promise<string | null> {
		const original = await this.download(
			this.deps.storage.publicUrl(asset.storageKey),
		);
		if (!original) {
			return null;
		}
		const oriented = await sharp(original)
			.rotate()
			.toBuffer({ resolveWithObject: true });
		const target = {
			width: Math.max(1, Math.round(box.width)),
			height: Math.max(1, Math.round(box.height)),
		};
		const crop = focalCropTo(
			{ width: oriented.info.width, height: oriented.info.height },
			asset.focalPoint ?? CENTER,
			target,
		);
		const jpeg = await sharp(oriented.data)
			.extract(crop)
			.resize(target.width, target.height, { fit: "cover" })
			.flatten({ background: "#ffffff" })
			.jpeg({ quality: 90 })
			.toBuffer();
		return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
	}

	/** A moldura no tamanho da caixa, com a transparência preservada. */
	private async fittedImage(
		mediaId: string,
		box: Box,
		fit: "cover" | "contain",
	): Promise<string | null> {
		const asset = (await this.deps.media.findById(
			mediaId,
		)) as PhotoAsset | null;
		if (!asset?.mimeType.startsWith("image/")) {
			return null;
		}
		const original = await this.download(
			this.deps.storage.publicUrl(asset.storageKey),
		);
		if (!original) {
			return null;
		}
		const png = await sharp(original)
			.rotate()
			.resize(
				Math.max(1, Math.round(box.width)),
				Math.max(1, Math.round(box.height)),
				{ fit, background: { r: 0, g: 0, b: 0, alpha: 0 } },
			)
			.png()
			.toBuffer();
		return `data:image/png;base64,${png.toString("base64")}`;
	}

	private async download(url: string): Promise<Buffer | null> {
		const response = await this.fetchImpl(url);
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw new Error(
				`Não foi possível baixar a imagem do padrão (HTTP ${response.status}).`,
			);
		}
		return Buffer.from(await response.arrayBuffer());
	}

	private async exists(url: string): Promise<boolean> {
		try {
			const response = await this.fetchImpl(url, { method: "HEAD" });
			return response.ok;
		} catch {
			return false;
		}
	}
}

const CENTER = { x: 0.5, y: 0.5 };
