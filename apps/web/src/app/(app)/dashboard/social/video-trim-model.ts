import {
	clipDuration,
	MIN_CLIP_SECONDS,
	normalizeClip,
	RENDER_MAX_SECONDS,
	type VideoClip,
} from "@portal-app/social";

/**
 * As contas da barra de corte, SEM JSX e SEM React (regra de testes do
 * projeto).
 *
 * Arrastar uma alça é aritmética de três números que precisam continuar
 * obedecendo a três regras ao mesmo tempo — o começo não passa do fim, o trecho
 * não fica menor que o mínimo, não fica maior que o teto. Feita dentro do
 * componente, essa conta só se prova arrastando com o mouse; aqui ela se prova
 * com uma tabela.
 *
 * Quem decide se o trecho SERVE continua sendo o domínio (`clipProblems`, que a
 * tela lê nos `blockers` do post). Aqui só se move a alça.
 */

/** Onde uma marca cai na barra, de 0 a 1. */
export function fractionOf(seconds: number, sourceSeconds: number): number {
	if (sourceSeconds <= 0) {
		return 0;
	}
	return clamp(seconds / sourceSeconds, 0, 1);
}

/** O inverso: a que segundo uma posição da barra corresponde. */
export function secondsAt(fraction: number, sourceSeconds: number): number {
	return clamp(fraction, 0, 1) * Math.max(0, sourceSeconds);
}

/**
 * O corte depois de mover uma das alças.
 *
 * **A alça arrastada manda, e a outra cede.** Puxar o começo para além do fim
 * empurra o fim, em vez de travar a alça no lugar — travar é o que faz uma
 * barra de corte parecer quebrada. O que não cede é o MÍNIMO: o trecho nunca
 * fica menor que ele, e a alça que empurra para dentro é que para.
 *
 * O teto do portal também é respeitado na hora: arrastar o fim para longe
 * demais para no teto, com a mensagem ficando para os `blockers` só quando a
 * pessoa insiste por outro caminho (trocar o vídeo, por exemplo).
 */
export function withHandle(
	clip: VideoClip,
	handle: "start" | "end",
	seconds: number,
): VideoClip {
	const source = Math.max(0, clip.sourceSeconds);
	// Num arquivo mais curto que o mínimo não há o que arrastar: o corte é o
	// arquivo inteiro, e o domínio o recusa com uma frase clara.
	const min = Math.min(MIN_CLIP_SECONDS, source);
	const value = clamp(seconds, 0, source);

	if (handle === "start") {
		const start = clamp(value, 0, Math.max(0, source - min));
		const end = clamp(
			Math.max(clip.endSeconds, start + min),
			start + min,
			Math.min(source, start + RENDER_MAX_SECONDS),
		);
		return normalizeClip({ ...clip, startSeconds: start, endSeconds: end });
	}

	const end = clamp(value, min, source);
	const start = clamp(
		Math.min(clip.startSeconds, end - min),
		Math.max(0, end - RENDER_MAX_SECONDS),
		Math.max(0, end - min),
	);
	return normalizeClip({ ...clip, startSeconds: start, endSeconds: end });
}

/**
 * Desliza o trecho INTEIRO, mantendo a duração — o que o teclado faz com as
 * setas sobre a faixa selecionada, e o que arrastar o meio da faixa faz com o
 * mouse.
 */
export function shiftBy(clip: VideoClip, seconds: number): VideoClip {
	const duration = clipDuration(clip);
	const start = clamp(
		clip.startSeconds + seconds,
		0,
		Math.max(0, clip.sourceSeconds - duration),
	);
	return normalizeClip({
		...clip,
		startSeconds: start,
		endSeconds: start + duration,
	});
}

/**
 * O passo do teclado: um segundo, ou um décimo com Shift.
 *
 * Existe porque a barra precisa ser operável sem mouse — e porque acertar o
 * quadro exato de um corte com o mouse, numa barra de 300 px para 90 s, é
 * impossível: cada pixel vale um terço de segundo.
 */
export function stepFor(fine: boolean): number {
	return fine ? 0.1 : 1;
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}
	return Math.min(Math.max(value, min), Math.max(min, max));
}
