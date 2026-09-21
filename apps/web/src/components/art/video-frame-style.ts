import type { VideoFrame } from "@portal-app/social";

/**
 * O quadro do vídeo traduzido em CSS — SEM JSX e SEM React (regra de testes do
 * projeto).
 *
 * A prévia do editor não redesenha o vídeo: ela põe um `<video>` de verdade no
 * buraco que o padrão deixou, com as mesmas medidas que o ffmpeg vai usar do
 * lado do servidor. As contas que traduzem "caixa de 1080×1080 em y=160 do
 * quadro de 1080×1920" para pixels de uma prévia de 320 px de largura moram
 * aqui, longe do componente, porque são exatamente o tipo de coisa que erra em
 * silêncio: meio por cento de diferença não quebra nada, só faz a prévia mentir.
 *
 * `object-fit: cover` com `object-position` é o equivalente exato, no
 * navegador, do `scale=…:force_original_aspect_ratio=increase` + `crop` do
 * ffmpeg — os dois ampliam até cobrir e cortam o excedente no ponto focal.
 */

export type VideoBoxStyle = {
	position: "absolute";
	left: string;
	top: string;
	width: string;
	height: string;
	borderRadius: string;
	transform: string;
	objectFit: "cover";
	objectPosition: string;
	opacity: number;
};

/**
 * Onde o `<video>` fica dentro da prévia, dado o fator de escala (largura da
 * prévia ÷ largura do quadro).
 *
 * Tudo em pixels da prévia, e não em porcentagem, porque o raio do canto e a
 * rotação precisam escalar junto — um `border-radius` em porcentagem vira
 * elipse numa caixa que não é quadrada.
 */
export function videoBoxStyle(
	frame: VideoFrame,
	scale: number,
	opacity = 1,
): VideoBoxStyle {
	const { box } = frame;
	return {
		position: "absolute",
		left: `${px(box.x * scale)}px`,
		top: `${px(box.y * scale)}px`,
		width: `${px(box.width * scale)}px`,
		height: `${px(box.height * scale)}px`,
		borderRadius: `${px(Math.min(frame.cornerRadius, box.width / 2, box.height / 2) * scale)}px`,
		// A rotação gira em torno do CENTRO da caixa, como no `rotatedBounds` do
		// domínio — que é o padrão do `transform-origin`, e é por isso que ele não
		// aparece aqui.
		transform: frame.rotation === 0 ? "none" : `rotate(${frame.rotation}deg)`,
		objectFit: "cover",
		objectPosition: `${pct(frame.focal.x)}% ${pct(frame.focal.y)}%`,
		opacity,
	};
}

/** Duas casas bastam para a prévia, e evitam um `left: 160.00000000000003px`. */
function px(value: number): number {
	return Math.round(value * 100) / 100;
}

function pct(fraction: number): number {
	return Math.round(Math.min(Math.max(fraction, 0), 1) * 1000) / 10;
}
