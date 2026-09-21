import {
	MIN_CLIP_SECONDS,
	RENDER_MAX_SECONDS,
	type VideoClip,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	fractionOf,
	secondsAt,
	shiftBy,
	stepFor,
	withHandle,
} from "@/app/(app)/dashboard/social/video-trim-model";

const corte = (over: Partial<VideoClip> = {}): VideoClip => ({
	mediaId: "video-1",
	sourceSeconds: 120,
	startSeconds: 20,
	endSeconds: 50,
	muted: false,
	...over,
});

describe("fractionOf / secondsAt", () => {
	it("a marca vira posição na barra, e a posição vira marca de volta", () => {
		expect(fractionOf(30, 120)).toBe(0.25);
		expect(secondsAt(0.25, 120)).toBe(30);
	});

	it("arquivo de duração zero não divide por zero", () => {
		expect(fractionOf(10, 0)).toBe(0);
	});

	it("posição fora da barra é presa nas pontas", () => {
		expect(fractionOf(500, 120)).toBe(1);
		expect(secondsAt(-1, 120)).toBe(0);
		expect(secondsAt(2, 120)).toBe(120);
	});
});

describe("withHandle", () => {
	it("mover o começo não mexe no fim, quando não precisa", () => {
		const clip = withHandle(corte(), "start", 35);
		expect(clip.startSeconds).toBe(35);
		expect(clip.endSeconds).toBe(50);
	});

	it("o começo passando do fim EMPURRA o fim, em vez de travar", () => {
		// Travar a alça é o que faz uma barra de corte parecer quebrada: a mão
		// continua andando e a alça fica para trás sem explicação.
		const clip = withHandle(corte(), "start", 60);
		expect(clip.startSeconds).toBe(60);
		expect(clip.endSeconds).toBe(60 + MIN_CLIP_SECONDS);
	});

	it("o fim passando do começo empurra o começo", () => {
		const clip = withHandle(corte(), "end", 10);
		expect(clip.endSeconds).toBe(10);
		expect(clip.startSeconds).toBe(10 - MIN_CLIP_SECONDS);
	});

	it("o mínimo é o que NÃO cede: o trecho nunca fica menor que ele", () => {
		const clip = withHandle(
			corte({ startSeconds: 0, endSeconds: 4 }),
			"end",
			1,
		);
		expect(clip.endSeconds - clip.startSeconds).toBeGreaterThanOrEqual(
			MIN_CLIP_SECONDS,
		);
	});

	it("arrastar o fim para longe demais para no teto do portal", () => {
		const clip = withHandle(
			corte({ sourceSeconds: 600, startSeconds: 0, endSeconds: 10 }),
			"end",
			500,
		);
		// O começo cede para que o trecho caiba no teto, e o fim vai onde pediram.
		expect(clip.endSeconds).toBe(500);
		expect(clip.endSeconds - clip.startSeconds).toBeLessThanOrEqual(
			RENDER_MAX_SECONDS,
		);
	});

	it("puxar o começo para trás encurta o trecho até o teto", () => {
		const clip = withHandle(
			corte({ sourceSeconds: 600, startSeconds: 400, endSeconds: 450 }),
			"start",
			100,
		);
		expect(clip.startSeconds).toBe(100);
		expect(clip.endSeconds - clip.startSeconds).toBeLessThanOrEqual(
			RENDER_MAX_SECONDS,
		);
	});

	it("as marcas nunca saem do arquivo", () => {
		expect(withHandle(corte(), "end", 999).endSeconds).toBe(120);
		expect(withHandle(corte(), "start", -50).startSeconds).toBe(0);
	});

	it("arquivo mais curto que o mínimo não trava a alça", () => {
		// Um vídeo de dois segundos não é publicável, e quem diz isso é o domínio
		// (`clipProblems`). A barra não pode ficar impossível de arrastar por causa
		// disso.
		const clip = withHandle(
			corte({ sourceSeconds: 2, startSeconds: 0, endSeconds: 2 }),
			"start",
			1,
		);
		expect(clip.startSeconds).toBeLessThanOrEqual(2);
		expect(clip.endSeconds).toBeLessThanOrEqual(2);
	});

	it("posição inválida não produz NaN", () => {
		const clip = withHandle(corte(), "start", Number.NaN);
		expect(Number.isFinite(clip.startSeconds)).toBe(true);
	});
});

describe("shiftBy", () => {
	it("desliza o trecho inteiro, mantendo a duração", () => {
		const clip = shiftBy(corte(), 30);
		expect(clip.startSeconds).toBe(50);
		expect(clip.endSeconds).toBe(80);
	});

	it("batendo no fim do arquivo, encosta sem encurtar o trecho", () => {
		const clip = shiftBy(corte(), 999);
		expect(clip.endSeconds).toBe(120);
		expect(clip.endSeconds - clip.startSeconds).toBe(30);
	});

	it("batendo no começo, idem", () => {
		const clip = shiftBy(corte(), -999);
		expect(clip.startSeconds).toBe(0);
		expect(clip.endSeconds).toBe(30);
	});
});

describe("stepFor", () => {
	it("um segundo com as setas, um décimo com Shift", () => {
		// Numa barra de 300 px para 90 s cada pixel vale um terço de segundo: sem
		// o passo fino, o quadro exato do corte é inalcançável.
		expect(stepFor(false)).toBe(1);
		expect(stepFor(true)).toBe(0.1);
	});
});
