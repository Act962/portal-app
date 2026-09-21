import {
	clipDuration,
	clipOffsets,
	formatSeconds,
	MAX_CLIPS,
	MIN_SEQUENCE_SECONDS,
	normalizeClip,
	normalizeSequence,
	RENDER_MAX_SECONDS,
	sequenceDuration,
	sequenceProblems,
	type VideoClip,
	wholeClip,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const corte = (over: Partial<VideoClip> = {}): VideoClip => ({
	mediaId: "video-1",
	sourceSeconds: 120,
	startSeconds: 10,
	endSeconds: 40,
	muted: false,
	...over,
});

describe("clipDuration", () => {
	it("é a distância entre as marcas", () => {
		expect(clipDuration(corte())).toBe(30);
	});

	it("nunca é negativa — marcas trocadas valem zero, não menos que zero", () => {
		expect(clipDuration(corte({ startSeconds: 40, endSeconds: 10 }))).toBe(0);
	});
});

describe("wholeClip", () => {
	it("pega o arquivo inteiro quando ele cabe no teto do portal", () => {
		expect(wholeClip("video-1", 45)).toEqual({
			mediaId: "video-1",
			sourceSeconds: 45,
			startSeconds: 0,
			endSeconds: 45,
			muted: false,
		});
	});

	it("nasce APARADO no teto quando o arquivo é mais longo", () => {
		// Nascer inválido obrigaria a redação a consertar um corte que ela não
		// fez; nascer aparado deixa o trabalho começar de um estado publicável.
		const clip = wholeClip("video-1", 600);
		expect(clip.endSeconds).toBe(RENDER_MAX_SECONDS);
		expect(sequenceProblems([clip], ["INSTAGRAM_REELS"])).toEqual([]);
	});

	it("aguenta duração absurda sem virar marca negativa", () => {
		expect(wholeClip("video-1", -5).endSeconds).toBe(0);
	});
});

describe("normalizeClip", () => {
	it("prende as marcas dentro do arquivo", () => {
		const clip = normalizeClip(
			corte({ startSeconds: -10, endSeconds: 999, sourceSeconds: 60 }),
		);
		expect(clip.startSeconds).toBe(0);
		expect(clip.endSeconds).toBe(60);
	});

	it("põe as marcas em ordem: o fim nunca vem antes do começo", () => {
		const clip = normalizeClip(corte({ startSeconds: 40, endSeconds: 10 }));
		expect(clip.startSeconds).toBe(40);
		expect(clip.endSeconds).toBe(40);
	});

	it("troca marca inválida pelo limite, em vez de propagar NaN", () => {
		expect(
			normalizeClip(corte({ startSeconds: Number.NaN })).startSeconds,
		).toBe(0);
	});
});

describe("sequenceDuration e clipOffsets", () => {
	it("a duração do vídeo é a SOMA dos trechos", () => {
		expect(
			sequenceDuration([
				corte({ startSeconds: 0, endSeconds: 10 }),
				corte({ startSeconds: 0, endSeconds: 5 }),
			]),
		).toBe(15);
	});

	it("sem trecho nenhum, duração zero", () => {
		expect(sequenceDuration([])).toBe(0);
	});

	it("cada trecho começa onde o anterior terminou, no vídeo montado", () => {
		// É o que a linha do tempo usa para desenhar as faixas lado a lado, e o
		// que o tocador usa para saber em qual trecho está.
		expect(
			clipOffsets([
				corte({ startSeconds: 0, endSeconds: 10 }),
				corte({ startSeconds: 0, endSeconds: 4 }),
				corte({ startSeconds: 0, endSeconds: 6 }),
			]),
		).toEqual([0, 10, 14]);
	});
});

describe("normalizeSequence", () => {
	it("apara cada trecho dentro do seu arquivo", () => {
		const clips = normalizeSequence([
			corte({ startSeconds: -5, endSeconds: 999, sourceSeconds: 60 }),
		]);
		expect(clips[0]).toMatchObject({ startSeconds: 0, endSeconds: 60 });
	});

	it("trecho de duração zero é DESCARTADO, não vira erro", () => {
		// Ele aparece quando alguém arrasta as duas alças para o mesmo ponto, e
		// o certo ali é a faixa sumir, não a tela travar.
		const clips = normalizeSequence([
			corte({ startSeconds: 10, endSeconds: 10 }),
			corte({ startSeconds: 0, endSeconds: 5 }),
		]);
		expect(clips).toHaveLength(1);
		expect(clips[0]?.endSeconds).toBe(5);
	});

	it("corta no teto de trechos", () => {
		const muitos = Array.from({ length: MAX_CLIPS + 5 }, () =>
			corte({ startSeconds: 0, endSeconds: 2 }),
		);
		expect(normalizeSequence(muitos)).toHaveLength(MAX_CLIPS);
	});
});

describe("sequenceProblems", () => {
	it("vídeo bom para os dois destinos não tem problema nenhum", () => {
		expect(
			sequenceProblems(
				[corte({ startSeconds: 0, endSeconds: 30 })],
				["INSTAGRAM_REELS", "INSTAGRAM_STORIES"],
			),
		).toEqual([]);
	});

	it("vários trechos curtos somam um vídeo válido", () => {
		// A régua mede a SOMA: o Instagram recebe um arquivo só. Medir trecho a
		// trecho recusaria uma montagem de cortes de um segundo, que é edição
		// perfeitamente normal.
		const clips = [
			corte({ startSeconds: 0, endSeconds: 1 }),
			corte({ startSeconds: 0, endSeconds: 1 }),
			corte({ startSeconds: 0, endSeconds: 2 }),
		];
		expect(sequenceProblems(clips, ["INSTAGRAM_REELS"])).toEqual([]);
	});

	it("sem trecho nenhum, pede o corte e para por aí", () => {
		expect(sequenceProblems([], ["INSTAGRAM_REELS"])).toEqual([
			"Escolha o trecho do vídeo que vai ao ar.",
		]);
	});

	it("vídeo curto demais é recusado", () => {
		const problems = sequenceProblems(
			[corte({ startSeconds: 0, endSeconds: MIN_SEQUENCE_SECONDS - 1 })],
			[],
		);
		expect(problems[0]).toContain("o mínimo é de");
	});

	it("curto demais reclama pelo portal E pela rede — os dois têm régua", () => {
		const problems = sequenceProblems(
			[corte({ startSeconds: 0, endSeconds: MIN_SEQUENCE_SECONDS - 1 })],
			["INSTAGRAM_REELS"],
		);
		expect(problems).toEqual([
			expect.stringContaining("o mínimo é de"),
			expect.stringContaining("Reels do Instagram pede ao menos"),
		]);
	});

	it("a SOMA passando do teto do portal fala do PORTAL, não da rede", () => {
		// A distinção importa: quem lê a frase precisa saber a quem pedir mais —
		// e o teto de noventa segundos é nosso, não do Instagram.
		const problems = sequenceProblems(
			[
				corte({ startSeconds: 0, endSeconds: 60, sourceSeconds: 200 }),
				corte({ startSeconds: 0, endSeconds: 60, sourceSeconds: 200 }),
			],
			[],
		);
		expect(problems[0]).toContain("o portal monta vídeos de até");
	});

	it("os Stories recusam mais de um minuto; o Reels aceita", () => {
		const clips = [
			corte({ startSeconds: 0, endSeconds: 80, sourceSeconds: 200 }),
		];
		expect(sequenceProblems(clips, ["INSTAGRAM_STORIES"])).toEqual([
			expect.stringContaining("Stories do Instagram aceita até"),
		]);
		expect(sequenceProblems(clips, ["INSTAGRAM_REELS"])).toEqual([]);
	});

	it("destino que não publica vídeo diz isso, em vez de medir a duração", () => {
		expect(
			sequenceProblems(
				[corte({ startSeconds: 0, endSeconds: 20 })],
				["FACEBOOK"],
			),
		).toEqual(["O Facebook não publica vídeo."]);
	});

	it("cada destino reclama por conta própria", () => {
		const clips = [
			corte({ startSeconds: 0, endSeconds: 80, sourceSeconds: 200 }),
		];
		expect(
			sequenceProblems(clips, ["INSTAGRAM_STORIES", "FACEBOOK"]),
		).toHaveLength(2);
	});

	it("no mínimo exato, passa", () => {
		expect(
			sequenceProblems(
				[{ ...corte(), startSeconds: 0, endSeconds: 3 }],
				["INSTAGRAM_REELS"],
			),
		).toEqual([]);
	});

	it("passar do teto de trechos é recusado", () => {
		const muitos = Array.from({ length: MAX_CLIPS + 1 }, () =>
			corte({ startSeconds: 0, endSeconds: 1 }),
		);
		expect(sequenceProblems(muitos, [])).toContainEqual(
			expect.stringContaining("trechos"),
		);
	});
});

describe("formatSeconds", () => {
	it("abaixo de um minuto, conta em segundos", () => {
		expect(formatSeconds(45)).toBe("45s");
		expect(formatSeconds(0)).toBe("0s");
	});

	it("de um minuto em diante, minuto e segundo com dois dígitos", () => {
		expect(formatSeconds(60)).toBe("1:00");
		expect(formatSeconds(64)).toBe("1:04");
		expect(formatSeconds(125)).toBe("2:05");
	});

	it("negativo é zero — a linha do tempo não mostra tempo para trás", () => {
		expect(formatSeconds(-10)).toBe("0s");
	});
});
