import { type Result, err, ok } from "@portal-app/shared-kernel";

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
export function mediaTypeFromMime(
	mimeType: string,
): Result<MediaType, UnsupportedMediaType> {
	const mime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";

	if (mime.startsWith("image/")) {
		return ok("IMAGE");
	}
	if (mime.startsWith("video/")) {
		return ok("VIDEO");
	}
	if (mime.startsWith("audio/")) {
		return ok("AUDIO");
	}
	if (DOCUMENT_MIME_TYPES.has(mime)) {
		return ok("DOCUMENT");
	}
	return err(new UnsupportedMediaType(mimeType));
}

/** O `accept` do input de arquivo — mesma lista, para a tela não divergir. */
export const ACCEPTED_UPLOAD_MIME = ["image/*", ...DOCUMENT_MIME_TYPES].join(",");
