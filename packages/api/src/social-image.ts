import type { MediaRepository, MediaStorage } from "@portal-app/media";
import {
	type CropAspect,
	croppedImageKey,
	focalCrop,
	OUTPUT_SIZE,
	type PublishableImage,
	type SocialImageSource,
} from "@portal-app/social";
import sharp from "sharp";

/**
 * A imagem que a Meta vai baixar: a da biblioteca, cortada na proporção do
 * feed respeitando o ponto focal, em JPEG, num endereço público (spec 08, D3).
 *
 * Mora na raiz de composição, e não no contexto de redes sociais, por dois
 * motivos: a resposta é da MÍDIA (fazer `social` importar `media` quebraria
 * `contextos-isolados`) e o `sharp` é biblioteca nativa — não tem lugar num
 * contexto cujo domínio não pode ter dependência nenhuma.
 *
 * **Gera uma vez e reaproveita.** O arquivo cortado vai para o mesmo
 * armazenamento, numa chave que inclui o ponto focal (`croppedImageKey`). Antes
 * de gerar, pergunta se ele já existe: reenviar um post que falhou não refaz o
 * corte, e mudar o ponto focal gera outra chave em vez de servir o corte velho.
 *
 * **Falha de rede aqui LANÇA**, em vez de devolver `null`. `null` significa "a
 * imagem não existe mais" e o worker grava isso como erro definitivo na
 * entrega. Um armazenamento fora do ar é transitório: lançar interrompe a
 * rodada com a entrega ainda pendente, e a próxima tenta de novo.
 */
export class CroppedImageSource implements SocialImageSource {
	private readonly fetchImpl: typeof fetch;

	constructor(
		private readonly deps: {
			media: MediaRepository;
			storage: MediaStorage;
			fetch?: typeof fetch;
		},
	) {
		this.fetchImpl = deps.fetch ?? fetch;
	}

	async resolve(
		mediaId: string,
		aspect: CropAspect | "original",
	): Promise<PublishableImage | null> {
		const asset = await this.deps.media.findById(mediaId);
		if (!asset?.mimeType.startsWith("image/")) {
			return null;
		}

		const altText = asset.altText?.value ?? "";
		const originalUrl = this.deps.storage.publicUrl(asset.storageKey);

		if (aspect === "original") {
			return { url: originalUrl, altText };
		}

		const focal = asset.focalPoint
			? { x: asset.focalPoint.x, y: asset.focalPoint.y }
			: { x: 0.5, y: 0.5 };
		const key = croppedImageKey(mediaId, aspect, focal);
		const url = this.deps.storage.publicUrl(key);

		if (await this.exists(url)) {
			return { url, altText };
		}

		const original = await this.fetchImpl(originalUrl);
		if (!original.ok) {
			// O arquivo sumiu do armazenamento, embora o registro exista: isso é
			// definitivo, não instabilidade.
			if (original.status === 404) {
				return null;
			}
			throw new Error(
				`Não foi possível baixar a imagem ${mediaId} (HTTP ${original.status}).`,
			);
		}

		const jpeg = await renderCrop(
			Buffer.from(await original.arrayBuffer()),
			focal,
			aspect,
		);

		const uploadUrl = await this.deps.storage.getUploadUrl(key, "image/jpeg");
		const upload = await this.fetchImpl(uploadUrl, {
			method: "PUT",
			headers: { "content-type": "image/jpeg" },
			body: new Uint8Array(jpeg),
		});
		if (!upload.ok) {
			throw new Error(
				`Não foi possível gravar o corte da imagem ${mediaId} (HTTP ${upload.status}).`,
			);
		}

		return { url, altText };
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

/**
 * O corte em si. A DECISÃO de onde cortar é do `focalCrop` (puro e testado);
 * aqui só se executa.
 *
 * `rotate()` sem argumento aplica a orientação EXIF antes de medir. Foto de
 * celular vem deitada com um marcador dizendo "gire"; medir antes de girar
 * trocaria largura por altura e cortaria o lugar errado.
 */
export async function renderCrop(
	input: Buffer,
	focal: { x: number; y: number },
	aspect: CropAspect,
): Promise<Buffer> {
	const oriented = await sharp(input)
		.rotate()
		.toBuffer({ resolveWithObject: true });

	const box = focalCrop(
		{ width: oriented.info.width, height: oriented.info.height },
		focal,
		aspect,
	);
	const size = OUTPUT_SIZE[aspect];

	return (
		sharp(oriented.data)
			.extract(box)
			.resize(size.width, size.height, { fit: "cover" })
			// Fundo branco para PNG com transparência: JPEG não tem alfa, e sem isto
			// o transparente viraria preto.
			.flatten({ background: "#ffffff" })
			.jpeg({ quality: 88, mozjpeg: true })
			.toBuffer()
	);
}
