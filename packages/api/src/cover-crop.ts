/**
 * As proporções que o recorte conhece, como par inteiro `[largura, altura]`.
 * Par e não fração: `900 * (16 / 9)` dá 1599,99… e o `floor` comeria um pixel.
 */
export const CROP_ASPECTS = {
	"16:9": [16, 9],
	"1:1": [1, 1],
} as const;

export type CropAspect = keyof typeof CROP_ASPECTS;

/**
 * Recorte na proporção pedida (16:9 por padrão — a capa), com posição relativa
 * ao espaço disponível para deslocamento.
 */
export function coverCrop(
	width: number,
	height: number,
	x: number,
	y: number,
	zoom: number,
	aspect: CropAspect = "16:9",
) {
	const [ratioW, ratioH] = CROP_ASPECTS[aspect];
	const cropWidth = Math.max(
		1,
		Math.floor(Math.min(width, (height * ratioW) / ratioH) / zoom),
	);
	const cropHeight = Math.max(1, Math.floor((cropWidth * ratioH) / ratioW));
	return {
		left: Math.round((width - cropWidth) * x),
		top: Math.round((height - cropHeight) * y),
		width: cropWidth,
		height: cropHeight,
	};
}
