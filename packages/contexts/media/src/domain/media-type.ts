import { err, ok, type Result } from "@portal-app/shared-kernel";

import { UnsupportedMediaType } from "./errors";

/**
 * Tipos de mídia que o agregado modela. Os quatro sempre existiram no modelo;
 * a partir da spec 06 o pipeline de upload atende IMAGE e DOCUMENT.
 */
export const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Tipos de documento aceitos (D6). Lista fechada, e não um `application/*`
 * genérico: `application/x-msdownload` também casaria com o curinga, e a
 * biblioteca de um portal não é lugar para executável.
 */
const DOCUMENT_MIME_TYPES = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.oasis.opendocument.text",
	"application/vnd.oasis.opendocument.spreadsheet",
	"text/csv",
	"text/plain",
]);

/**
 * O tipo DERIVA do mime, no domínio — a tela não escolhe (D6).
 *
 * Deixar o cliente classificar seria confiar nele para dizer que um `.exe` é
 * imagem, e com isso pular os invariantes de acessibilidade que valem para
 * `IMAGE`. Aqui a classificação é uma função do arquivo, não uma opinião.
 *
 * O mime chega do navegador e pode vir com parâmetros (`text/csv;charset=utf-8`)
 * ou em caixa alta; ambos são normalizados antes de comparar.
 */
/** O mime sem parâmetros e em minúscula — o navegador manda os dois jeitos. */
function normalizeMime(mimeType: string): string {
	return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function mediaTypeFromMime(
	mimeType: string,
): Result<MediaType, UnsupportedMediaType> {
	const mime = normalizeMime(mimeType);

	if (mime.startsWith("image/")) {
		return ok("IMAGE");
	}
	if (mime.startsWith("video/")) {
		return VIDEO_MIME_TYPES.has(mime)
			? ok("VIDEO")
			: err(new UnsupportedMediaType(mimeType));
	}
	if (mime.startsWith("audio/")) {
		return ok("AUDIO");
	}
	if (DOCUMENT_MIME_TYPES.has(mime)) {
		return ok("DOCUMENT");
	}
	return err(new UnsupportedMediaType(mimeType));
}

/**
 * Vídeos aceitos (spec 12). Lista fechada, e não `video/*`, pelo mesmo motivo
 * do documento — e por um segundo: o que entra aqui vai ser transcodificado
 * pelo portal e depois BAIXADO pela Meta. Um contêiner exótico atravessaria o
 * envio inteiro para morrer no ffmpeg, com o post já montado.
 *
 * Os três cobrem o que a redação produz: `mp4` de qualquer câmera ou celular,
 * `quicktime` (`.mov`) do iPhone, `webm` de gravação de tela.
 */
const VIDEO_MIME_TYPES = new Set([
	"video/mp4",
	"video/quicktime",
	"video/webm",
]);

/** Este arquivo é um vídeo que o portal aceita? */
export function isAcceptedVideoMime(mimeType: string): boolean {
	return VIDEO_MIME_TYPES.has(normalizeMime(mimeType));
}

/** O `accept` do input de arquivo — mesma lista, para a tela não divergir. */
export const ACCEPTED_UPLOAD_MIME = [
	"image/*",
	...VIDEO_MIME_TYPES,
	...DOCUMENT_MIME_TYPES,
].join(",");

/** Só vídeo — o `accept` da tela de vídeo, que não aceita foto. */
export const ACCEPTED_VIDEO_MIME = [...VIDEO_MIME_TYPES].join(",");
