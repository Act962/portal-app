import { type MediaType, mediaTypeFromMime } from "@portal-app/media";

/**
 * O upload de arquivo, fora de qualquer componente.
 *
 * Estava tudo dentro da tela da biblioteca, e passou a ser preciso em mais um
 * lugar — o campo de imagem do logo e da foto do colunista, que envia sem
 * passar pela biblioteca. Duplicar significaria manter duas versões da mesma
 * conversa com o storage; a segunda cópia é a que envelhece calada.
 *
 * Aqui mora só o que fala com o NAVEGADOR e com o storage. A classificação do
 * arquivo continua sendo do domínio (`mediaTypeFromMime`), e a validação dos
 * metadados continua sendo do agregado `MediaAsset` — este módulo não decide
 * nada disso.
 */

export type PickedFile = {
	file: File;
	/** Derivado do mime pelo DOMÍNIO — a tela não classifica (D6). */
	type: MediaType;
	/** Imagem e vídeo têm preview local; documento não abre em `<img>`. */
	previewUrl: string | null;
	width: number | null;
	height: number | null;
	/** Duração em segundos — só vídeo (spec 12). */
	durationSeconds: number | null;
};

/**
 * Prepara o arquivo escolhido. Imagem tem preview e dimensões reais lidas aqui
 * (o domínio as exige, A29); vídeo tem preview e DURAÇÃO; documento não tem nem
 * uma coisa nem outra — e exigir seria inventar regra para PDF.
 */
export function readPickedFile(file: File): Promise<PickedFile> {
	const type = mediaTypeFromMime(file.type);
	if (type.isErr()) {
		return Promise.reject(new Error(type.unwrapErr().message));
	}
	const mediaType = type.unwrap();

	if (mediaType === "IMAGE") {
		return readImage(file);
	}
	if (mediaType === "VIDEO") {
		return readVideo(file);
	}
	return Promise.resolve({
		file,
		type: mediaType,
		previewUrl: null,
		width: null,
		height: null,
		durationSeconds: null,
	});
}

function readImage(file: File): Promise<PickedFile> {
	return new Promise((resolve, reject) => {
		const previewUrl = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () =>
			resolve({
				file,
				type: "IMAGE",
				previewUrl,
				width: img.naturalWidth,
				height: img.naturalHeight,
				durationSeconds: null,
			});
		img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
		img.src = previewUrl;
	});
}

/**
 * Mede o vídeo NO NAVEGADOR, antes de subir.
 *
 * É aqui, e não no servidor, porque medir no servidor significaria baixar o
 * arquivo inteiro de volta do armazenamento só para ler um cabeçalho — e o
 * navegador já tem o arquivo na mão. A duração é o que a tela de corte precisa
 * para desenhar a régua, e o que o post copia para saber sozinho se o trecho
 * escolhido cabe no limite da rede.
 *
 * `preload="metadata"` basta: o navegador lê o cabeçalho e para, sem carregar
 * os megabytes do vídeo.
 */
function readVideo(file: File): Promise<PickedFile> {
	return new Promise((resolve, reject) => {
		const previewUrl = URL.createObjectURL(file);
		const video = document.createElement("video");
		video.preload = "metadata";
		video.onloadedmetadata = () => {
			// Arquivo de gravação de tela às vezes vem com duração `Infinity` até
			// alguém tocá-lo. Sem duração não há corte, e é melhor recusar aqui do
			// que subir cinquenta megabytes para descobrir depois.
			if (!Number.isFinite(video.duration) || video.duration <= 0) {
				URL.revokeObjectURL(previewUrl);
				reject(
					new Error(
						"Não foi possível ler a duração deste vídeo. Converta-o para MP4 e tente de novo.",
					),
				);
				return;
			}
			resolve({
				file,
				type: "VIDEO",
				previewUrl,
				width: video.videoWidth || null,
				height: video.videoHeight || null,
				durationSeconds: video.duration,
			});
		};
		video.onerror = () => {
			URL.revokeObjectURL(previewUrl);
			reject(new Error("Arquivo de vídeo inválido ou em formato não aceito."));
		};
		video.src = previewUrl;
	});
}

/**
 * PUT direto no storage pela URL pré-assinada, reportando o progresso (A28).
 * O arquivo nunca passa pelo nosso servidor.
 *
 * `XMLHttpRequest` e não `fetch` porque só ele reporta progresso de UPLOAD — o
 * `fetch` só sabe dizer que terminou, e uma barra que salta de 0 a 100 não
 * informa nada a quem está subindo uma foto de 8 MB.
 */
export function putWithProgress(
	url: string,
	file: File,
	onProgress: (pct: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
		xhr.onerror = () => reject(new Error("Falha de rede no upload"));
		xhr.send(file);
	});
}
