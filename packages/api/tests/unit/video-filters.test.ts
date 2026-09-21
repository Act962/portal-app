import {
	type ArtDesign,
	type VideoClip,
	videoFrameFor,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import {
	ffmpegArgs,
	filterGraph,
	hasAudioStream,
	OUTPUT_FPS,
	type VideoInputs,
} from "../../src/video-filters";

/**
 * O grafo de filtros se prova AQUI, sem transcodificar nada.
 *
 * Um `overlay` no lugar errado não lança exceção: produz um MP4 válido com a
 * faixa vermelha fora do lugar, e ninguém vê antes do Instagram. Estes testes
 * são o que substitui olhar o vídeo.
 */

const clip = (over: Partial<VideoClip> = {}): VideoClip => ({
	mediaId: "v-1",
	sourceSeconds: 60,
	startSeconds: 4,
	endSeconds: 20,
	muted: false,
	...over,
});

const lugarDaFoto = (extra: Record<string, unknown> = {}) =>
	[
		{
			id: "foto",
			name: "",
			kind: "PHOTO" as const,
			x: 0,
			y: 420,
			width: 1080,
			height: 1080,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			cornerRadius: 0,
			stroke: null,
			...extra,
		},
	] as ArtDesign["elements"];

function frameCom(clips: readonly VideoClip[], elements = lugarDaFoto()) {
	return videoFrameFor({
		format: "9:16",
		design: { background: "#ffffff", elements, variables: [] },
		clips,
	});
}

function arquivos(
	count: number,
	over: Partial<VideoInputs> = {},
	hasAudio = true,
): VideoInputs {
	return {
		under: "/tmp/under.png",
		over: "/tmp/over.png",
		mask: "/tmp/mask.png",
		clips: Array.from({ length: count }, (_, i) => ({
			url: `https://cdn.test/clip${i}.mp4`,
			hasAudio,
		})),
		output: "/tmp/out.mp4",
		...over,
	};
}

describe("filterGraph — um trecho só", () => {
	it("empilha na ordem do editor: fundo, vídeo, camada de cima", () => {
		const graph = filterGraph(frameCom([clip()]), arquivos(1));
		expect(graph).toContain(
			"[0:v][vid]overlay=0:420:shortest=1:format=auto[base]",
		);
		expect(graph).toContain(
			"[base][1:v]overlay=0:0:format=auto,format=yuv420p[out]",
		);
	});

	it("amplia até COBRIR a caixa e corta o excedente no ponto focal", () => {
		const graph = filterGraph(frameCom([clip()]), arquivos(1));
		expect(graph).toContain(
			"scale=1080:1080:force_original_aspect_ratio=increase",
		);
		expect(graph).toContain("crop=1080:1080:");
		// As vírgulas da expressão vão escapadas: cruas, separariam dois filtros.
		expect(graph).toContain("max(0\\,min(in_w-out_w\\,");
	});

	it("normaliza pixel e cadência — o `concat` exige que os trechos batam", () => {
		const graph = filterGraph(frameCom([clip()]), arquivos(1));
		expect(graph).toContain("setsar=1");
		expect(graph).toContain(`fps=${OUTPUT_FPS}`);
	});

	it("sem canto arredondado, nenhuma máscara entra no grafo", () => {
		const graph = filterGraph(frameCom([clip()]), arquivos(1, { mask: null }));
		expect(graph).not.toContain("alphamerge");
		expect(graph).not.toContain("[2:v]alphaextract");
	});

	it("com canto arredondado, o alfa da máscara vira o alfa do vídeo", () => {
		const frame = frameCom([clip()], lugarDaFoto({ cornerRadius: 48 }));
		const graph = filterGraph(frame, arquivos(1));
		expect(frame.masked).toBe(true);
		expect(graph).toContain("[2:v]alphaextract[mask0]");
		expect(graph).toContain("[v0][mask0]alphamerge[v0]");
	});

	it("caixa girada gira em radianos e é posta pela ENVOLVENTE", () => {
		const graph = filterGraph(
			frameCom(
				[clip()],
				lugarDaFoto({ rotation: 90, width: 400, height: 200 }),
			),
			arquivos(1, { mask: null }),
		);
		expect(graph).toContain(`rotate=${(Math.PI / 2).toFixed(6)}`);
		expect(graph).toContain("c=none");
		expect(graph).toContain("[0:v][vid]overlay=100:320");
	});
});

describe("filterGraph — vários trechos", () => {
	const tres = [
		clip(),
		clip({ mediaId: "v-2", startSeconds: 0, endSeconds: 5 }),
		clip({ startSeconds: 30, endSeconds: 34 }),
	];

	it("emenda os trechos na ordem, com vídeo e áudio no MESMO concat", () => {
		// Emendá-los em dois grafos separados deixa a voz andando na frente da
		// imagem a cada corte.
		const graph = filterGraph(frameCom(tres), arquivos(3, { mask: null }));
		expect(graph).toContain(
			"[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vid][aud]",
		);
	});

	it("cada trecho vem da sua própria entrada, depois das imagens", () => {
		const graph = filterGraph(frameCom(tres), arquivos(3, { mask: null }));
		// Sem máscara: fundo [0], cima [1], trechos a partir de [2].
		expect(graph).toContain("[2:v]scale=");
		expect(graph).toContain("[3:v]scale=");
		expect(graph).toContain("[4:v]scale=");
	});

	it("com máscara, os trechos andam uma entrada para a frente", () => {
		const graph = filterGraph(
			frameCom(tres, lugarDaFoto({ cornerRadius: 24 })),
			arquivos(3),
		);
		expect(graph).toContain("[3:v]scale=");
		// A máscara é UMA imagem usada por três trechos — um filtro só se consome
		// uma vez, daí o `split`.
		expect(graph).toContain("[2:v]alphaextract,split=3[mask0][mask1][mask2]");
	});

	it("trecho mudo no meio puxa o som de uma fonte de SILÊNCIO própria", () => {
		// Sem isto, `concat` com `a=1` recusaria a emenda — e com `a=0` o vídeo
		// inteiro sairia mudo por causa de um corte só.
		const clips = [clip(), clip({ muted: true }), clip()];
		const graph = filterGraph(frameCom(clips), arquivos(3, { mask: null }));
		// Trechos em [2..4]; a primeira fonte de silêncio vem logo depois.
		expect(graph).toContain("[2:a]aformat");
		expect(graph).toContain("[5:a]aformat");
		expect(graph).toContain("[4:a]aformat");
	});

	it("cada trecho mudo tem a SUA fonte de silêncio, não um `asplit` de uma só", () => {
		// Uma fonte infinita repartida com `asplit` foi a primeira tentativa, e
		// o ffmpeg morria com "Cannot allocate memory": os ramos param de
		// consumir quando o trecho acaba e o resto fica na memória.
		const clips = [clip(), clip({ muted: true }), clip({ muted: true })];
		const graph = filterGraph(frameCom(clips), arquivos(3, { mask: null }));
		expect(graph).not.toContain("asplit");
		expect(graph).not.toContain("atrim");
		expect(graph).toContain("[5:a]aformat");
		expect(graph).toContain("[6:a]aformat");
	});

	it("arquivo SEM trilha de áudio conta como mudo", () => {
		const args = ffmpegArgs(frameCom([clip(), clip()]), {
			...arquivos(2, { mask: null }),
			clips: [
				{ url: "a.mp4", hasAudio: true },
				{ url: "b.mp4", hasAudio: false },
			],
		});
		expect(args).toContain("lavfi");
	});

	it("nenhum trecho com som: o vídeo sai sem trilha nenhuma", () => {
		const clips = [clip({ muted: true }), clip({ muted: true })];
		const graph = filterGraph(frameCom(clips), arquivos(2, { mask: null }));
		expect(graph).toContain("concat=n=2:v=1:a=0[vid]");
		expect(graph).not.toContain("[aout]");
		expect(graph).not.toContain("asplit");
	});
});

describe("ffmpegArgs", () => {
	it("salta ANTES de abrir cada arquivo — decodificar até o corte custaria o vídeo inteiro", () => {
		const args = ffmpegArgs(frameCom([clip()]), arquivos(1, { mask: null }));
		const entrada = args.indexOf("https://cdn.test/clip0.mp4");
		expect(args.slice(entrada - 5, entrada - 1)).toEqual([
			"-ss",
			"4",
			"-t",
			"16",
		]);
	});

	it("trecho que começa no zero não gasta um -ss", () => {
		const args = ffmpegArgs(
			frameCom([clip({ startSeconds: 0, endSeconds: 10 })]),
			arquivos(1, { mask: null }),
		);
		expect(args).not.toContain("-ss");
	});

	it("as imagens entram em laço, mas com FIM — senão o ffmpeg estoura a memória", () => {
		// Imagem em laço é fonte infinita; com o `concat` no meio do grafo, os
		// quadros da emenda só saem depois de todos os trechos lidos, e nesse
		// meio-tempo o ffmpeg empilha quadros da imagem até cair.
		const args = ffmpegArgs(
			frameCom([clip({ startSeconds: 0, endSeconds: 10 })]),
			arquivos(1, { mask: null }),
		);
		expect(args.filter((arg) => arg === "-loop")).toHaveLength(2);
		// Duas imagens com `-t 10`, mais o `-t` de cada trecho e o da saída.
		expect(args.filter((arg) => arg === "-t")).toHaveLength(4);
		expect(args.filter((arg) => arg === "-framerate")).toHaveLength(2);
	});

	it("a máscara só entra quando há canto arredondado", () => {
		expect(ffmpegArgs(frameCom([clip()]), arquivos(1))).not.toContain(
			"/tmp/mask.png",
		);
		expect(
			ffmpegArgs(
				frameCom([clip()], lugarDaFoto({ cornerRadius: 24 })),
				arquivos(1),
			),
		).toContain("/tmp/mask.png");
	});

	it("a duração da saída é a SOMA dos trechos", () => {
		const args = ffmpegArgs(
			frameCom([
				clip({ startSeconds: 0, endSeconds: 10 }),
				clip({ startSeconds: 0, endSeconds: 5 }),
			]),
			arquivos(2, { mask: null }),
		);
		// O último `-t` é o da saída; os anteriores são das entradas.
		expect(args[args.lastIndexOf("-t") + 1]).toBe("15");
		// E as imagens de fundo duram o vídeo inteiro, não um trecho.
		expect(args[args.indexOf("-t") + 1]).toBe("15");
	});

	it("com som, mapeia a trilha emendada; sem som, não mapeia nenhuma", () => {
		const comSom = ffmpegArgs(frameCom([clip()]), arquivos(1, { mask: null }));
		expect(comSom).toContain("[aout]");
		expect(comSom).toContain("aac");

		const mudo = ffmpegArgs(
			frameCom([clip({ muted: true })]),
			arquivos(1, { mask: null }),
		);
		expect(mudo).not.toContain("[aout]");
		expect(mudo).not.toContain("aac");
	});

	it("o silêncio só entra como entrada quando algum trecho precisa dele", () => {
		const semSilencio = ffmpegArgs(
			frameCom([clip(), clip()]),
			arquivos(2, { mask: null }),
		);
		expect(semSilencio).not.toContain("lavfi");

		const comSilencio = ffmpegArgs(
			frameCom([clip(), clip({ muted: true })]),
			arquivos(2, { mask: null }),
		);
		expect(comSilencio).toContain("lavfi");
	});

	it("sai no que o Instagram aceita: yuv420p, 30 fps e índice na frente", () => {
		const args = ffmpegArgs(frameCom([clip()]), arquivos(1, { mask: null }));
		expect(args).toContain("yuv420p");
		expect(args[args.indexOf("-r") + 1]).toBe(String(OUTPUT_FPS));
		expect(args).toContain("+faststart");
		expect(args.at(-1)).toBe("/tmp/out.mp4");
	});

	it("não deixa casas do ponto flutuante vazarem para a linha de comando", () => {
		// `0.1 + 0.2` dá `0.30000000000000004`; o ffmpeg aceitaria, mas o log
		// vira ilegível e a chave do cache passa a depender de ruído binário.
		const args = ffmpegArgs(
			frameCom([clip({ startSeconds: 0.1 + 0.2, endSeconds: 10 })]),
			arquivos(1, { mask: null }),
		);
		expect(args).toContain("0.3");
	});
});

describe("hasAudioStream", () => {
	it("reconhece a faixa de áudio na conversa do ffmpeg", () => {
		const stderr = [
			"Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'a.mp4':",
			"  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1080x1920",
			"  Stream #0:1[0x2](und): Audio: aac (LC), 44100 Hz, stereo",
		].join("\n");
		expect(hasAudioStream(stderr)).toBe(true);
	});

	it("vídeo sem trilha responde não", () => {
		const stderr = [
			"Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'a.mp4':",
			"  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1080x1920",
		].join("\n");
		expect(hasAudioStream(stderr)).toBe(false);
	});

	it("a palavra 'Audio' solta no texto não conta como faixa", () => {
		// Um falso positivo aqui manda `[i:a]` para um arquivo mudo, e o ffmpeg
		// morre com "stream not found" — longe daqui, na fila de entrega.
		expect(hasAudioStream("Audio conversion failed")).toBe(false);
	});
});
