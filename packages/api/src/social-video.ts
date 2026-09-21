import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildArtLayer, type LoadedImage } from "@portal-app/art-scene";
import type { MediaRepository, MediaStorage } from "@portal-app/media";
import {
	type ArtContent,
	type ArtDesign,
	type ArtSelection,
	type PublishableVideo,
	type SocialVideoSource,
	selectionAsTemplate,
	textsFor,
	type VideoArtworkRequest,
	type VideoFrame,
	videoArtKey,
	videoFrameFor,
} from "@portal-app/social";

import { loadArtEngine } from "./social-art";
import { loadSharp } from "./social-image";
import { type ClipInput, ffmpegArgs, hasAudioStream } from "./video-filters";

/**
 * O montador de vídeos no padrão (spec 12, D3).
 *
 * Ele existe porque o padrão de arte é um DESENHO, e desenho não se sobrepõe a
 * vídeo com o mesmo motor que o desenha: o Konva rasteriza um quadro parado, e
 * o ffmpeg repete esse quadro sobre os trinta por segundo do vídeo. A divisão
 * de trabalho é essa, e é o que mantém a prévia do editor e o arquivo publicado
 * iguais — as duas camadas saem da MESMA cena que o `ArtRenderer` usa na foto.
 *
 * Mora na raiz de composição pelas mesmas duas razões do `ArtRenderer`: precisa
 * da biblioteca de mídia e depende de binário nativo, e nenhum dos dois cabe
 * num contexto.
 */

// ── o binário ──────────────────────────────────────────────────────────────

let ffmpegPath: Promise<string> | null = null;

/**
 * O caminho do ffmpeg, carregado só quando o primeiro vídeo é montado.
 *
 * `import()` tardio pelo mesmo motivo do `sharp` (ver `social-image.ts`): são
 * oitenta megabytes de binário que não têm por que entrar no pacote comum a
 * TODAS as rotas do servidor. Uma instalação sem o binário derruba a montagem
 * do vídeo, não o portal.
 */
export function loadFfmpeg(): Promise<string> {
	ffmpegPath ??= (async () => {
		const mod = (await import("ffmpeg-static")) as unknown as {
			default: string | null;
		};
		const path = mod.default;
		if (!path) {
			throw new Error(
				"O ffmpeg não está instalado neste ambiente (ffmpeg-static sem binário).",
			);
		}
		return path;
	})();
	return ffmpegPath;
}

/**
 * Roda o ffmpeg e devolve o que ele reclamou.
 *
 * O `stderr` é acumulado e só aparece NO ERRO. O ffmpeg escreve tudo nele —
 * inclusive o que deu certo —, e despejar isso no log a cada vídeo enterraria
 * a única linha que importa no dia em que algo falhar.
 */
export async function runFfmpeg(
	args: readonly string[],
	/**
	 * Aceitar código de saída diferente de zero e devolver o que ele falou — é
	 * o que a sondagem de áudio usa, porque `ffmpeg -i arquivo` sem trabalho a
	 * fazer SEMPRE termina em erro, mesmo tendo lido o cabeçalho direito.
	 */
	tolerateFailure = false,
): Promise<string> {
	const binary = await loadFfmpeg();
	return new Promise<string>((resolve, reject) => {
		const child = spawn(binary, [...args], { windowsHide: true });
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0 || tolerateFailure) {
				resolve(stderr);
				return;
			}
			const tail = stderr.trim().split("\n").slice(-4).join(" ");
			reject(new Error(`O ffmpeg terminou com código ${code}. ${tail}`));
		});
	});
}

/**
 * O arquivo tem trilha de áudio?
 *
 * Uma invocação sem saída: o ffmpeg lê o cabeçalho, lista as faixas no
 * `stderr` e termina reclamando que não lhe deram o que fazer. É barato — não
 * decodifica nada — e evita carregar um `ffprobe` de oitenta megabytes só para
 * responder sim ou não.
 *
 * A pergunta precisa de resposta porque, num `filter_complex`, `[i:a]` de um
 * arquivo mudo derruba o ffmpeg inteiro com "stream not found" — e ali não
 * existe o `?` que salva o `-map`.
 */
export async function probeHasAudio(url: string): Promise<boolean> {
	const stderr = await runFfmpeg(
		["-hide_banner", "-i", url, "-t", "0", "-f", "null", "-"],
		true,
	);
	return hasAudioStream(stderr);
}

// ── o montador ─────────────────────────────────────────────────────────────

type StoredAsset = {
	id: string;
	storageKey: string;
	mimeType: string;
	altText: { value: string } | null;
	focalPoint: { x: number; y: number } | null;
};

type SkiaCanvas = { toBuffer(format: string): Promise<Buffer> };

const CENTER = { x: 0.5, y: 0.5 };

export class VideoArtRenderer implements SocialVideoSource {
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

	/**
	 * O vídeo que a Meta vai baixar, no armazenamento. `null` quando o arquivo
	 * não é vídeo ou não existe mais — erro definitivo para a entrega.
	 *
	 * **Monta uma vez e reaproveita** (D5): a chave é o hash do desenho MAIS o
	 * corte, então reenviar um post que falhou não remonta nada, e aparar meio
	 * segundo gera outro arquivo em vez de servir o antigo.
	 */
	async artwork(
		request: VideoArtworkRequest,
	): Promise<PublishableVideo | null> {
		if (request.clips.length === 0) {
			return null;
		}
		// Os arquivos de todos os trechos, buscados UMA vez cada: o mesmo vídeo
		// costuma aparecer em dois ou três cortes da mesma montagem.
		const assets = new Map<string, StoredAsset>();
		for (const mediaId of new Set(request.clips.map((clip) => clip.mediaId))) {
			const found = (await this.deps.media.findById(
				mediaId,
			)) as StoredAsset | null;
			if (!found?.mimeType.startsWith("video/")) {
				return null;
			}
			assets.set(mediaId, found);
		}
		// O enquadramento e o texto alternativo saem do PRIMEIRO trecho: é ele
		// que dá a capa, e é a capa que o Instagram mostra na grade.
		const first = assets.get(
			request.clips[0]?.mediaId as string,
		) as StoredAsset;

		const template = selectionAsTemplate(request.selection);
		const inputs = {
			values: request.selection.values,
			texts: request.selection.texts,
		};
		const key = videoArtKey({
			templateId: request.selection.templateId,
			templateVersion: request.selection.version,
			photo: { mediaId: first.id, focal: first.focalPoint ?? CENTER },
			texts: textsFor(template.design, request.content, inputs),
			images: Object.fromEntries(
				template.elements.flatMap((element) =>
					element.kind === "IMAGE" ? [[element.id, element.mediaId]] : [],
				),
			),
			// Os trechos INTEIROS entram na chave, na ordem: trocar a ordem de dois
			// cortes dá outro vídeo, e servir o antigo seria um defeito invisível.
			clips: request.clips.map((clip) => ({
				mediaId: clip.mediaId,
				startSeconds: clip.startSeconds,
				endSeconds: clip.endSeconds,
				muted: clip.muted,
			})),
		});

		const url = this.deps.storage.publicUrl(key.video);
		const coverUrl = this.deps.storage.publicUrl(key.cover);
		const altText = first.altText?.value ?? "";

		if (await this.exists(url)) {
			return { url, coverUrl, altText };
		}

		const frame = videoFrameFor({
			format: request.selection.format,
			design: template.design,
			focal: first.focalPoint ?? CENTER,
			clips: request.clips,
		});

		// A sondagem de áudio é por ARQUIVO, não por trecho: dois cortes do
		// mesmo vídeo respondem igual, e cada sondagem é uma abertura de arquivo
		// pela rede.
		const audio = new Map<string, boolean>();
		for (const [mediaId, file] of assets) {
			audio.set(
				mediaId,
				await probeHasAudio(this.deps.storage.publicUrl(file.storageKey)),
			);
		}
		const clips: ClipInput[] = request.clips.map((clip) => ({
			url: this.deps.storage.publicUrl(
				(assets.get(clip.mediaId) as StoredAsset).storageKey,
			),
			hasAudio: audio.get(clip.mediaId) ?? false,
		}));

		const built = await this.compose(frame, clips, request);

		await this.upload(key.video, "video/mp4", built.video);
		await this.upload(key.cover, "image/jpeg", built.cover);
		return { url, coverUrl, altText };
	}

	/**
	 * Desenha as camadas, chama o ffmpeg e devolve o MP4 com a capa.
	 *
	 * O vídeo de ORIGEM entra no ffmpeg pela URL pública, sem passar pelo disco.
	 * Não é economia de linhas: a função que roda isto tem `/tmp` pequeno, e um
	 * arquivo de celular de noventa segundos come metade dele antes de a
	 * montagem começar. Quem lê por faixas é o ffmpeg, e só o trecho pedido.
	 */
	private async compose(
		frame: VideoFrame,
		clips: readonly ClipInput[],
		request: VideoArtworkRequest,
	): Promise<{ video: Buffer; cover: Buffer }> {
		const dir = await mkdtemp(join(tmpdir(), "portal-video-"));
		try {
			const under = join(dir, "under.png");
			const over = join(dir, "over.png");
			const mask = join(dir, "mask.png");
			const output = join(dir, "out.mp4");
			const cover = join(dir, "cover.jpg");

			const [underPng, overPng, maskPng] = await Promise.all([
				this.layer(frame, frame.under, request),
				this.layer(frame, frame.over, request),
				frame.masked ? this.mask(frame) : Promise.resolve(null),
			]);

			await Promise.all([
				writeFile(under, underPng),
				writeFile(over, overPng),
				...(maskPng ? [writeFile(mask, maskPng)] : []),
			]);

			await runFfmpeg(
				ffmpegArgs(frame, {
					under,
					over,
					mask: maskPng ? mask : null,
					clips,
					output,
				}),
			);

			// A capa sai do vídeo JÁ MONTADO, e não do arquivo original: é o
			// primeiro quadro com o padrão em cima — o que a redação viu na prévia
			// e o que o Instagram mostra na grade do perfil.
			await runFfmpeg([
				"-y",
				"-hide_banner",
				"-loglevel",
				"error",
				"-i",
				output,
				"-frames:v",
				"1",
				"-q:v",
				"3",
				cover,
			]);

			return { video: await readFile(output), cover: await readFile(cover) };
		} finally {
			// O diretório temporário some SEMPRE. Numa função que reaproveita o
			// contêiner entre execuções, um MP4 esquecido a cada envio enche o
			// `/tmp`, e a falha aparece num post que não tem nada de errado.
			await rm(dir, { recursive: true, force: true });
		}
	}

	/** Uma das duas camadas do padrão, em PNG com transparência. */
	private async layer(
		frame: VideoFrame,
		design: ArtDesign,
		request: { content: ArtContent; selection: ArtSelection },
	): Promise<Buffer> {
		const { Konva } = await loadArtEngine();
		const stage = new Konva.Stage({
			width: frame.canvas.width,
			height: frame.canvas.height,
		});
		try {
			const { layer } = buildArtLayer(Konva, {
				format: request.selection.format,
				design,
				content: request.content,
				inputs: {
					values: request.selection.values,
					texts: request.selection.texts,
				},
				assets: await this.assets(design),
			});
			stage.add(layer);
			const native = stage.toCanvas() as unknown as SkiaCanvas;
			return await native.toBuffer("png");
		} finally {
			stage.destroy();
		}
	}

	/**
	 * A máscara do canto arredondado: a caixa do vídeo em branco sobre
	 * transparente, do tamanho dela.
	 *
	 * Desenhada com o mesmo Konva, e não calculada à mão, porque é o mesmo
	 * `cornerRadius` com a mesma limitação de raio — reimplementá-la aqui é
	 * combinar de divergir na primeira vez que um dos dois mudar.
	 */
	private async mask(frame: VideoFrame): Promise<Buffer> {
		const { Konva } = await loadArtEngine();
		const stage = new Konva.Stage({
			width: frame.box.width,
			height: frame.box.height,
		});
		try {
			const layer = new Konva.Layer();
			layer.add(
				new Konva.Rect({
					x: 0,
					y: 0,
					width: frame.box.width,
					height: frame.box.height,
					cornerRadius: Math.min(
						frame.cornerRadius,
						frame.box.width / 2,
						frame.box.height / 2,
					),
					fill: "#ffffff",
				}),
			);
			stage.add(layer);
			const native = stage.toCanvas() as unknown as SkiaCanvas;
			return await native.toBuffer("png");
		} finally {
			stage.destroy();
		}
	}

	/**
	 * As molduras e logos de uma camada. **Sem foto**: o lugar da foto é onde o
	 * vídeo entra, e as duas camadas já vêm sem ele (`videoFrameFor` o tirou).
	 * Passar uma foto aqui a desenharia debaixo do vídeo, onde ninguém a veria,
	 * gastando um download por envio.
	 */
	private async assets(design: ArtDesign) {
		const loaded = await Promise.all(
			design.elements
				.filter((element) => element.kind === "IMAGE")
				.map(async (element) => {
					const image = await this.loadImage(
						(element as { mediaId: string }).mediaId,
					);
					return [(element as { mediaId: string }).mediaId, image] as const;
				}),
		);
		return {
			photo: null,
			images: Object.fromEntries(
				loaded.filter(
					(entry): entry is readonly [string, LoadedImage] => entry[1] !== null,
				),
			),
		};
	}

	/**
	 * Baixa e prepara uma moldura, igual ao `ArtRenderer`: o `sharp` endireita
	 * pela orientação EXIF (o skia não o faz) e reduz o que passa do quadro.
	 * Arquivo que sumiu (404) não lança — a moldura só some, como na foto.
	 */
	private async loadImage(mediaId: string): Promise<LoadedImage | null> {
		const asset = (await this.deps.media.findById(
			mediaId,
		)) as StoredAsset | null;
		if (!asset?.mimeType.startsWith("image/")) {
			return null;
		}
		const response = await this.fetchImpl(
			this.deps.storage.publicUrl(asset.storageKey),
		);
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw new Error(
				`Não foi possível baixar a imagem do padrão (HTTP ${response.status}).`,
			);
		}
		const sharp = await loadSharp();
		const prepared = await sharp(Buffer.from(await response.arrayBuffer()))
			.rotate()
			.resize(2160, 2160, { fit: "inside", withoutEnlargement: true })
			.png()
			.toBuffer();
		const engine = await loadArtEngine();
		const image = await engine.loadImage(prepared);
		return { image, width: image.width, height: image.height };
	}

	private async upload(
		key: string,
		contentType: string,
		body: Buffer,
	): Promise<void> {
		const uploadUrl = await this.deps.storage.getUploadUrl(key, contentType);
		const response = await this.fetchImpl(uploadUrl, {
			method: "PUT",
			headers: { "content-type": contentType },
			body: new Uint8Array(body),
		});
		if (!response.ok) {
			throw new Error(
				`Não foi possível gravar o vídeo montado (HTTP ${response.status}).`,
			);
		}
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
