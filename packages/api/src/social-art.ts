import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	buildArtLayer,
	type Konva,
	type LoadedImage,
	type SceneAssets,
	textWarnings,
} from "@portal-app/art-scene";
import type { MediaRepository, MediaStorage } from "@portal-app/media";
import {
	type ArtContent,
	type ArtInputs,
	type ArtTemplate,
	artImageKey,
	NO_INPUTS,
	type PublishableImage,
	TEMPLATE_FONT_FAMILIES,
	TEMPLATE_FONTS,
	type TemplateFontFamily,
	type TemplateFontSpec,
	textsFor,
} from "@portal-app/social";
import sharp from "sharp";

/**
 * O desenhista dos padrões de arte no servidor (spec 10, D1).
 *
 * Desenha a MESMA cena do editor — `@portal-app/art-scene` — com o Konva sobre
 * o skia-canvas. Mora na raiz de composição porque precisa da mídia (a foto, a
 * moldura) e de binário nativo; nada disso cabe no contexto.
 *
 * Duas partes:
 *
 * 1. **`loadArtEngine`** carrega o Konva com o backend do skia e registra as
 *    fontes — uma vez por processo, e só quando a primeira arte é pedida: o
 *    binário nativo não pesa em quem nunca desenha.
 * 2. **`ArtRenderer`** busca foto e moldura, desenha, e — para publicar — grava
 *    o JPEG no armazenamento numa chave que é cache (09, D8).
 */

// ── fontes (09, D6; 10, D4) ─────────────────────────────────────────────────

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
 * `exports` do `@fontsource`, não consegue e derruba a rota inteira com "module
 * not found". Checar a existência de um caminho é só sistema de arquivos.
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
 * processo. As fontes são dependência dos DOIS pacotes por isso.
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

/** Todos os arquivos de uma família — cada peso, e o itálico se ela tiver. */
export function fontFilesFor(family: TemplateFontFamily): string[] {
	const spec: TemplateFontSpec = TEMPLATE_FONTS[family];
	return spec.weights.flatMap((weight) =>
		(spec.italic ? [false, true] : [false]).map((italic) =>
			fontFilePath(family, weight, italic),
		),
	);
}

// ── o motor ────────────────────────────────────────────────────────────────

type SkiaImage = LoadedImage["image"] & { width: number; height: number };
type SkiaCanvas = {
	toBuffer(format: string, options?: object): Promise<Buffer>;
};

export type ArtEngine = {
	Konva: Konva;
	loadImage(data: Buffer): Promise<SkiaImage>;
};

let engine: Promise<ArtEngine> | null = null;

/**
 * O Konva com o backend do skia-canvas e as fontes registradas. Uma vez por
 * processo: o backend troca a fábrica de canvas da instância, e registrar as
 * fontes de novo a cada arte seria ler dezenas de arquivos à toa.
 */
export function loadArtEngine(): Promise<ArtEngine> {
	engine ??= (async () => {
		const skia = await import("skia-canvas");
		const { default: Konva } = await import("konva");
		await import("konva/skia-backend");
		for (const family of TEMPLATE_FONT_FAMILIES) {
			skia.FontLibrary.use(family, fontFilesFor(family));
		}
		return {
			Konva: Konva as Konva,
			// O `Image` do skia é o que o Konva desenha; o tipo dele não conversa
			// com o `CanvasImageSource` do DOM, que é o que a cena declara.
			loadImage: (data) =>
				skia.loadImage(data) as unknown as Promise<SkiaImage>,
		};
	})();
	return engine;
}

// ── desenho ────────────────────────────────────────────────────────────────

export type ArtRequest = {
	template: ArtTemplate;
	/** A foto do post. `null` com lugar de foto desenha o lugar em cinza. */
	photoMediaId: string | null;
	content: ArtContent;
	inputs?: ArtInputs;
};

type PhotoAsset = {
	id: string;
	storageKey: string;
	mimeType: string;
	altText: { value: string } | null;
	focalPoint: { x: number; y: number } | null;
};

const CENTER = { x: 0.5, y: 0.5 };

/**
 * Busca as entradas e desenha — a prévia (PNG na hora) ou a arte publicada
 * (JPEG no armazenamento, com cache pela chave).
 *
 * Falha de rede LANÇA, como no `CroppedImageSource`: armazenamento instável é
 * passageiro, e a entrega fica pendente para a próxima rodada. Arquivo que não
 * existe mais (404) não lança: a foto vira o lugar cinza e a moldura some.
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

	/** A prévia: PNG na largura pedida, nada gravado. */
	async preview(request: ArtRequest, width = 540): Promise<Buffer> {
		const photo = await this.photoAsset(request);
		return this.draw(request, photo, { format: "png", width });
	}

	/** Os textos que não cabem nem no tamanho mínimo (D8). */
	async warnings(
		request: Pick<ArtRequest, "template" | "content" | "inputs">,
	): Promise<string[]> {
		const { Konva } = await loadArtEngine();
		return textWarnings(Konva, {
			design: request.template.design,
			content: request.content,
			inputs: request.inputs,
		});
	}

	/**
	 * A arte que vai ao ar, no armazenamento. `null` quando o padrão pede foto e
	 * a foto não é imagem ou não existe mais — erro definitivo para a entrega.
	 */
	async publishable(request: ArtRequest): Promise<PublishableImage | null> {
		const { template } = request;
		const photo = await this.photoAsset(request);
		if (template.photoElement && request.photoMediaId && !photo) {
			return null;
		}

		const key = artImageKey({
			templateId: template.id,
			templateVersion: template.version,
			photo: photo
				? { mediaId: photo.id, focal: photo.focalPoint ?? CENTER }
				: null,
			texts: textsFor(
				template.design,
				request.content,
				request.inputs ?? NO_INPUTS,
			),
			images: Object.fromEntries(
				template.elements.flatMap((element) =>
					element.kind === "IMAGE" ? [[element.id, element.mediaId]] : [],
				),
			),
		});
		const url = this.deps.storage.publicUrl(key);
		const altText = photo?.altText?.value ?? "";

		if (await this.exists(url)) {
			return { url, altText };
		}

		const jpeg = await this.draw(request, photo, { format: "jpg" });
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

	private async draw(
		request: ArtRequest,
		photo: PhotoAsset | null,
		output: { format: "png" | "jpg"; width?: number },
	): Promise<Buffer> {
		const engine = await loadArtEngine();
		const { Konva } = engine;
		const { template } = request;
		const canvas = template.canvas;
		const assets = await this.assets(engine, template, photo);

		const stage = new Konva.Stage({
			width: canvas.width,
			height: canvas.height,
		});
		try {
			const { layer } = buildArtLayer(Konva, {
				format: template.format,
				design: template.design,
				content: request.content,
				inputs: request.inputs,
				assets,
			});
			stage.add(layer);
			const native = stage.toCanvas({
				pixelRatio: (output.width ?? canvas.width) / canvas.width,
			}) as unknown as SkiaCanvas;
			return await native.toBuffer(
				output.format,
				output.format === "jpg" ? { quality: 0.9 } : undefined,
			);
		} finally {
			stage.destroy();
		}
	}

	private async assets(
		engine: ArtEngine,
		template: ArtTemplate,
		photo: PhotoAsset | null,
	): Promise<SceneAssets> {
		const [photoImage, images] = await Promise.all([
			photo ? this.loadAsset(engine, photo, "jpeg") : null,
			Promise.all(
				template.mediaIds.map(async (mediaId) => {
					const asset = (await this.deps.media.findById(
						mediaId,
					)) as PhotoAsset | null;
					const loaded = asset?.mimeType.startsWith("image/")
						? await this.loadAsset(engine, asset, "png")
						: null;
					return [mediaId, loaded] as const;
				}),
			),
		]);
		return {
			photo:
				photo && photoImage
					? { ...photoImage, focal: photo.focalPoint ?? CENTER }
					: null,
			images: Object.fromEntries(
				images.filter((entry): entry is readonly [string, LoadedImage] =>
					Boolean(entry[1]),
				),
			),
		};
	}

	/**
	 * Baixa e prepara uma imagem: o `sharp` endireita pela orientação EXIF (o
	 * skia não o faz) e reduz o que passa do quadro — uma foto de 6000 px não
	 * precisa entrar inteira na memória do canvas. PNG preserva a transparência
	 * da moldura.
	 */
	private async loadAsset(
		engine: ArtEngine,
		asset: PhotoAsset,
		format: "jpeg" | "png",
	): Promise<LoadedImage | null> {
		const original = await this.download(
			this.deps.storage.publicUrl(asset.storageKey),
		);
		if (!original) {
			return null;
		}
		const pipeline = sharp(original)
			.rotate()
			.resize(2160, 2160, { fit: "inside", withoutEnlargement: true });
		const prepared = await (format === "jpeg"
			? pipeline.jpeg({ quality: 92 })
			: pipeline.png()
		).toBuffer();
		const image = await engine.loadImage(prepared);
		return { image, width: image.width, height: image.height };
	}

	private async photoAsset(request: ArtRequest): Promise<PhotoAsset | null> {
		if (!request.template.photoElement || !request.photoMediaId) {
			return null;
		}
		const asset = (await this.deps.media.findById(
			request.photoMediaId,
		)) as PhotoAsset | null;
		return asset?.mimeType.startsWith("image/") ? asset : null;
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
