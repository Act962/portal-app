import { MAX_CLIPS, type VideoClip } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	addClip,
	allMuted,
	moveClip,
	positionAt,
	removeClipAt,
	replaceClipAt,
	setAllMuted,
	trackWidths,
} from "@/app/(app)/dashboard/social/videos/video-editor-model";

const clip = (over: Partial<VideoClip> = {}): VideoClip => ({
	mediaId: "v-1",
	sourceSeconds: 60,
	startSeconds: 0,
	endSeconds: 10,
	muted: false,
	...over,
});

describe("addClip", () => {
	it("acrescenta no fim", () => {
		const clips = addClip([clip()], clip({ mediaId: "v-2" }));
		expect(clips.map((item) => item.mediaId)).toEqual(["v-1", "v-2"]);
	});

	it("cheia, a lista não cresce", () => {
		const cheia = Array.from({ length: MAX_CLIPS }, () => clip());
		expect(addClip(cheia, clip())).toHaveLength(MAX_CLIPS);
	});
});

describe("removeClipAt e replaceClipAt", () => {
	it("tira o trecho da posição", () => {
		const clips = removeClipAt([clip(), clip({ mediaId: "v-2" })], 0);
		expect(clips.map((item) => item.mediaId)).toEqual(["v-2"]);
	});

	it("índice fora da lista não muda nada", () => {
		expect(removeClipAt([clip()], 9)).toHaveLength(1);
	});

	it("troca o trecho da posição, e só ele", () => {
		const clips = replaceClipAt(
			[clip(), clip({ mediaId: "v-2" })],
			1,
			clip({ mediaId: "v-3" }),
		);
		expect(clips.map((item) => item.mediaId)).toEqual(["v-1", "v-3"]);
	});
});

describe("moveClip", () => {
	it("leva o trecho para a posição pedida", () => {
		const clips = moveClip(
			[clip({ mediaId: "a" }), clip({ mediaId: "b" }), clip({ mediaId: "c" })],
			0,
			2,
		);
		expect(clips.map((item) => item.mediaId)).toEqual(["b", "c", "a"]);
	});

	it("puxa para trás sem embaralhar o resto", () => {
		const clips = moveClip(
			[clip({ mediaId: "a" }), clip({ mediaId: "b" }), clip({ mediaId: "c" })],
			2,
			0,
		);
		expect(clips.map((item) => item.mediaId)).toEqual(["c", "a", "b"]);
	});

	it("movimento fora da lista é IGNORADO, não preso na ponta", () => {
		// Um clique sem efeito é melhor do que um clique que reordena o resto
		// sem ninguém pedir.
		const clips = [clip({ mediaId: "a" }), clip({ mediaId: "b" })];
		expect(moveClip(clips, 0, -1).map((item) => item.mediaId)).toEqual([
			"a",
			"b",
		]);
		expect(moveClip(clips, 1, 5).map((item) => item.mediaId)).toEqual([
			"a",
			"b",
		]);
		expect(moveClip(clips, 0, 0).map((item) => item.mediaId)).toEqual([
			"a",
			"b",
		]);
	});
});

describe("setAllMuted e allMuted", () => {
	it("o botão do som vale para o vídeo inteiro", () => {
		const clips = setAllMuted([clip(), clip({ muted: true })], true);
		expect(allMuted(clips)).toBe(true);
		expect(allMuted(setAllMuted(clips, false))).toBe(false);
	});

	it("um trecho com som já basta para o vídeo não estar mudo", () => {
		expect(allMuted([clip({ muted: true }), clip()])).toBe(false);
	});

	it("sem trecho nenhum, não está mudo — está vazio", () => {
		expect(allMuted([])).toBe(false);
	});
});

describe("positionAt", () => {
	const tres = [
		clip({ startSeconds: 5, endSeconds: 15 }),
		clip({ mediaId: "v-2", startSeconds: 0, endSeconds: 4 }),
		clip({ mediaId: "v-3", startSeconds: 30, endSeconds: 36 }),
	];

	it("no começo, o primeiro trecho a partir da marca DELE", () => {
		// É o que faz a prévia tocar a emenda sem emendar nada: o tocador entra
		// no ponto do arquivo, não no zero.
		expect(positionAt(tres, 0)).toEqual({ index: 0, sourceSeconds: 5 });
	});

	it("dentro do segundo trecho, converte para o tempo do arquivo dele", () => {
		// 10 s da montagem = 10 - 10 = 0 s dentro do segundo trecho, que começa
		// no zero do próprio arquivo.
		expect(positionAt(tres, 10)).toEqual({ index: 1, sourceSeconds: 0 });
		expect(positionAt(tres, 12)).toEqual({ index: 1, sourceSeconds: 2 });
	});

	it("no terceiro trecho, idem", () => {
		expect(positionAt(tres, 15)).toEqual({ index: 2, sourceSeconds: 31 });
	});

	it("depois do fim, fica no último trecho em vez de sumir", () => {
		const position = positionAt(tres, 999);
		expect(position?.index).toBe(2);
	});

	it("sem trecho nenhum, não há posição", () => {
		expect(positionAt([], 0)).toBeNull();
	});
});

describe("trackWidths", () => {
	it("cada faixa ocupa o tempo que vale", () => {
		const widths = trackWidths([
			clip({ startSeconds: 0, endSeconds: 30 }),
			clip({ startSeconds: 0, endSeconds: 10 }),
		]);
		expect(widths[0]).toBeCloseTo(75);
		expect(widths[1]).toBeCloseTo(25);
	});

	it("as faixas somam a linha inteira", () => {
		const widths = trackWidths([
			clip({ startSeconds: 0, endSeconds: 60 }),
			clip({ startSeconds: 0, endSeconds: 1 }),
			clip({ startSeconds: 0, endSeconds: 1 }),
		]);
		expect(widths.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
	});

	it("trecho curtíssimo ainda é clicável", () => {
		// Sem um mínimo, meio segundo num vídeo de noventa vira uma tira de dois
		// pixels — impossível de acertar com o mouse.
		const widths = trackWidths([
			clip({ startSeconds: 0, endSeconds: 89 }),
			clip({ startSeconds: 0, endSeconds: 0.5 }),
		]);
		expect(widths[1]).toBeGreaterThanOrEqual(3.5);
	});

	it("lista vazia não divide por zero", () => {
		expect(trackWidths([])).toEqual([]);
	});
});
