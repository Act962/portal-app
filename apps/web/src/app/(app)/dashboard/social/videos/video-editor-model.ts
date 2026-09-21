import {
	clipDuration,
	clipOffsets,
	MAX_CLIPS,
	type VideoClip,
	type VideoSequence,
} from "@portal-app/social";

/**
 * As operações da linha do tempo, SEM JSX e SEM React (regra de testes do
 * projeto).
 *
 * Mexer numa lista ordenada — acrescentar, tirar, trocar de lugar — parece
 * trivial e é onde mora o defeito silencioso: um `splice` com o índice trocado
 * não quebra nada, só publica os cortes fora de ordem. Aqui isso se prova com
 * uma tabela; dentro do componente, só arrastando com o mouse.
 *
 * Quem diz se a montagem SERVE continua sendo o domínio (`sequenceProblems`,
 * que a tela lê nos `blockers` do post). Aqui só se move peça.
 */

/** O trecho acrescentado no fim. Cheia, a lista não cresce. */
export function addClip(clips: VideoSequence, clip: VideoClip): VideoClip[] {
	return clips.length >= MAX_CLIPS ? [...clips] : [...clips, clip];
}

/** A lista sem o trecho da posição. Índice fora da lista não muda nada. */
export function removeClipAt(clips: VideoSequence, index: number): VideoClip[] {
	return clips.filter((_, position) => position !== index);
}

/** O trecho da posição, trocado. */
export function replaceClipAt(
	clips: VideoSequence,
	index: number,
	clip: VideoClip,
): VideoClip[] {
	return clips.map((current, position) =>
		position === index ? clip : current,
	);
}

/**
 * O trecho movido de lugar — é o que os botões de ordem fazem.
 *
 * Movimento fora da lista é IGNORADO, e não preso na ponta: "subir" o primeiro
 * trecho não faz nada, e um clique sem efeito é melhor do que um clique que
 * reordena o resto sem ninguém pedir.
 */
export function moveClip(
	clips: VideoSequence,
	from: number,
	to: number,
): VideoClip[] {
	if (
		from === to ||
		from < 0 ||
		to < 0 ||
		from >= clips.length ||
		to >= clips.length
	) {
		return [...clips];
	}
	const next = [...clips];
	const [moved] = next.splice(from, 1);
	if (moved) {
		next.splice(to, 0, moved);
	}
	return next;
}

/** Todos os trechos com o mesmo som — o botão que vale para o vídeo inteiro. */
export function setAllMuted(
	clips: VideoSequence,
	muted: boolean,
): VideoClip[] {
	return clips.map((clip) => ({ ...clip, muted }));
}

/** O vídeo inteiro está mudo? Só quando TODO trecho está. */
export function allMuted(clips: VideoSequence): boolean {
	return clips.length > 0 && clips.every((clip) => clip.muted);
}

/**
 * Em que trecho o vídeo montado está, num dado segundo — e em que ponto DO
 * ARQUIVO daquele trecho.
 *
 * É o que faz a prévia tocar a emenda sem emendar nada: o tocador vai de um
 * arquivo ao outro na hora certa, em vez de esperar um MP4 que só existe
 * depois de publicar.
 */
export function positionAt(
	clips: VideoSequence,
	second: number,
): { index: number; sourceSeconds: number } | null {
	if (clips.length === 0) {
		return null;
	}
	const offsets = clipOffsets(clips);
	for (let index = clips.length - 1; index >= 0; index -= 1) {
		const start = offsets[index] ?? 0;
		if (second >= start || index === 0) {
			const clip = clips[index] as VideoClip;
			const into = Math.min(
				Math.max(second - start, 0),
				Math.max(clipDuration(clip) - 0.05, 0),
			);
			return { index, sourceSeconds: clip.startSeconds + into };
		}
	}
	return null;
}

/**
 * Quanto cada trecho ocupa da linha do tempo, em porcentagem.
 *
 * Um mínimo de 4% por faixa: sem ele, um corte de meio segundo num vídeo de
 * noventa vira uma tira de dois pixels — impossível de acertar com o mouse, e
 * invisível para quem só quer conferir quantos cortes existem.
 */
export function trackWidths(clips: VideoSequence): number[] {
	const durations = clips.map(clipDuration);
	const total = durations.reduce((sum, value) => sum + value, 0);
	if (total <= 0) {
		return clips.map(() => (clips.length > 0 ? 100 / clips.length : 0));
	}
	const raw = durations.map((value) => (value / total) * 100);
	const floored = raw.map((value) => Math.max(value, 4));
	// Reescala para voltar a somar 100 — senão a última faixa sai da tela.
	const grown = floored.reduce((sum, value) => sum + value, 0);
	return floored.map((value) => (value / grown) * 100);
}
