/** Recorte 16:9 com posição relativa ao espaço disponível para deslocamento. */
export function coverCrop(
	width: number,
	height: number,
	x: number,
	y: number,
	zoom: number,
) {
	const cropWidth = Math.max(
		1,
		Math.floor(Math.min(width, (height * 16) / 9) / zoom),
	);
	const cropHeight = Math.max(1, Math.floor((cropWidth * 9) / 16));
	return {
		left: Math.round((width - cropWidth) * x),
		top: Math.round((height - cropHeight) * y),
		width: cropWidth,
		height: cropHeight,
	};
}
