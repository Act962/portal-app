import type { VideoFrame } from "@portal-app/social";

/**
 * Os argumentos do ffmpeg que emendam os trechos e queimam o padrão por cima
 * (spec 12, D3).
 *
 * **Função pura**, e é o ponto deste arquivo existir: montar um grafo de
 * filtros é a parte que erra em silêncio. Um `overlay` no lugar errado não
 * lança exceção nenhuma — produz um MP4 válido com a faixa vermelha dois
 * centímetros fora do lugar, e ninguém vê antes do Instagram. Assim o grafo se
 * prova com uma tabela de casos, sem transcodificar nada.
 *
 * A pilha é sempre a mesma, e é a do editor:
 *
 * ```
 *   over.png          ← o que está ACIMA do lugar da foto (com transparência)
 *   os trechos        ← recortados, emendados e postos na caixa
 *   under.png         ← o fundo do quadro e o que está ABAIXO
 * ```
 *
 * As ENTRADAS têm ordem fixa, e é de propósito: as imagens primeiro, os trechos
 * depois. Com os trechos na frente, o índice do `under.png` mudaria a cada
 * trecho acrescentado, e todo `[0:v]` do grafo passaria a depender de quantos
 * cortes a redação fez.
 *
 * ```
 *   [0] under.png            [base + i]      trecho i, cortado por -ss/-t
 *   [1] over.png             [base + N + k]  silêncio do k-ésimo trecho mudo
 *   [2] mask.png (opcional)  base = 3 com máscara, 2 sem
 * ```
 */

export type ClipInput = {
	/** O arquivo, ou a URL pública de onde o ffmpeg o lê por faixas. */
	url: string;
	/**
	 * O arquivo tem trilha de áudio?
	 *
	 * Vem de fora porque é propriedade do ARQUIVO, não do desenho — quem a
	 * descobre é o renderizador, com uma sondagem barata. Sem ela, `[i:a]` num
	 * vídeo mudo derruba o ffmpeg inteiro com "stream not found", e não há
	 * `?` que valha dentro de um `filter_complex`.
	 */
	hasAudio: boolean;
};

export type VideoInputs = {
	/** O PNG do fundo, do tamanho do quadro. */
	under: string;
	/** O PNG de cima, do tamanho do quadro, com transparência. */
	over: string;
	/** O PNG da máscara do canto arredondado, do tamanho da CAIXA. */
	mask?: string | null;
	/** Os arquivos dos trechos, NA MESMA ORDEM de `frame.segments`. */
	clips: readonly ClipInput[];
	output: string;
};

/**
 * Quantos quadros por segundo o vídeo sai.
 *
 * Fixo, e não herdado do arquivo, por três razões. O Instagram aceita de 23 a
 * 60 fps e recusa fora disso — e celular gravando em 120 fps para câmera lenta
 * não é raro. O padrão é uma imagem PARADA: reencodar a 30 dá um arquivo menor
 * que preservar os 60 de um vídeo cuja metade da tela não muda. E, com vários
 * trechos, emendar exige que todos cheguem ao `concat` na MESMA cadência.
 */
export const OUTPUT_FPS = 30;

/** O formato de áudio comum a todos os trechos — o `concat` exige que batam. */
const AUDIO_FORMAT =
	"aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo";

/** Uma imagem parada como fonte de vídeo finita, na cadência da saída. */
function loopedImage(path: string, seconds: number): string[] {
	return [
		"-loop",
		"1",
		"-framerate",
		String(OUTPUT_FPS),
		"-t",
		String(seconds),
		"-i",
		path,
	];
}

/** Quantos segundos o vídeo montado tem: a soma dos trechos. */
function totalSeconds(frame: VideoFrame): number {
	return round(
		frame.segments.reduce((total, seg) => total + seg.durationSeconds, 0),
		3,
	);
}

/** Quais trechos entram com som de verdade. */
function audible(frame: VideoFrame, files: VideoInputs): boolean[] {
	return frame.segments.map(
		(segment, index) =>
			!segment.muted && (files.clips[index]?.hasAudio ?? false),
	);
}

/**
 * A duração de cada trecho que precisa de silêncio, na ordem.
 *
 * Vazio quando NENHUM trecho tem som: aí o vídeo sai sem trilha nenhuma, que é
 * o certo — não se inventa uma faixa muda para um vídeo inteiramente mudo.
 */
function silentDurations(frame: VideoFrame, files: VideoInputs): number[] {
	const sound = audible(frame, files);
	if (!sound.some(Boolean)) {
		return [];
	}
	return frame.segments
		.filter((_, index) => !sound[index])
		.map((segment) => round(segment.durationSeconds, 3));
}

/** A linha de comando inteira, na ordem em que o ffmpeg a espera. */
export function ffmpegArgs(frame: VideoFrame, files: VideoInputs): string[] {
	const duration = totalSeconds(frame);
	const withMask = Boolean(frame.masked && files.mask);
	const sound = audible(frame, files);
	const anySound = sound.some(Boolean);

	return [
		// Sobrescreve a saída sem perguntar; o processo não tem terminal.
		"-y",
		// Só o que interessa no log: o resto é um banner de trinta linhas por
		// execução, e o que importa aqui é a mensagem do erro.
		"-hide_banner",
		"-loglevel",
		"error",

		// [0] o fundo e [1] a camada de cima, repetidos pelo tempo do vídeo.
		//
		// **`-t` em cada uma, e não só `-loop 1`.** Imagem em laço é uma fonte
		// INFINITA; com o `concat` no meio do grafo, os quadros da emenda só
		// aparecem depois que todos os trechos foram lidos, e enquanto isso o
		// ffmpeg segue decodificando as imagens e empilhando quadros — até cair
		// com "Cannot allocate memory". Com `-t`, as três fontes terminam.
		//
		// `-framerate` iguala a cadência à do vídeo (a imagem em laço sai a 25
		// por omissão), o que poupa o `overlay` de reamostrar a cada quadro.
		...loopedImage(files.under, duration),
		...loopedImage(files.over, duration),

		// [2] a máscara do canto arredondado, quando há.
		...(withMask ? loopedImage(files.mask as string, duration) : []),

		// [base + i] cada trecho. O `-ss` vem ANTES do `-i` de propósito: assim o
		// ffmpeg salta pelo índice do arquivo em vez de decodificar e jogar fora
		// tudo até o ponto de corte — a diferença entre segundos e dezenas deles
		// num trecho que começa perto do fim.
		...frame.segments.flatMap((segment, index) => [
			...(segment.startSeconds > 0
				? ["-ss", String(round(segment.startSeconds, 3))]
				: []),
			"-t",
			String(round(segment.durationSeconds, 3)),
			"-i",
			files.clips[index]?.url ?? "",
		]),

		// [base + N + k] uma fonte de silêncio POR trecho mudo, cada uma com a
		// duração exata dele.
		//
		// Uma só, repartida com `asplit`, foi a primeira tentativa — e o ffmpeg
		// morria com "Cannot allocate memory": o `anullsrc` é infinito, os ramos
		// param de consumir quando o trecho acaba, e o que sobra fica em memória
		// até o processo cair. Fonte finita não tem esse problema, e ainda sai
		// mais simples: sem `asplit` e sem `atrim`.
		...silentDurations(frame, files).flatMap((seconds) => [
			"-f",
			"lavfi",
			"-t",
			String(seconds),
			"-i",
			"anullsrc=channel_layout=stereo:sample_rate=44100",
		]),

		"-filter_complex",
		filterGraph(frame, files),

		"-map",
		"[out]",
		...(anySound ? ["-map", "[aout]"] : []),

		"-c:v",
		"libx264",
		// `veryfast` é a escolha consciente: a montagem roda numa função com teto
		// de duração (ver RENDER_MAX_SECONDS), e `medium` gastaria o dobro do
		// tempo para uma diferença de qualidade que ninguém vê num story.
		"-preset",
		"veryfast",
		"-crf",
		"23",
		// O Instagram recusa qualquer coisa que não seja yuv420p — é o formato
		// que todo aparelho decodifica.
		"-pix_fmt",
		"yuv420p",
		"-r",
		String(OUTPUT_FPS),
		// Um quadro-chave a cada 2 s: é o que a Meta pede para o corte do preview.
		"-g",
		String(OUTPUT_FPS * 2),
		// Sem isto o índice fica no FIM do arquivo, e quem baixa (a Meta) precisa
		// puxar o arquivo inteiro antes de começar a processar.
		"-movflags",
		"+faststart",
		...(anySound ? ["-c:a", "aac", "-b:a", "128k"] : []),
		// O fundo e a camada de cima são infinitos (`-loop 1`); é a soma dos
		// trechos que manda no fim.
		"-t",
		String(duration),
		files.output,
	];
}

/** O grafo de filtros, o argumento do `-filter_complex`. */
export function filterGraph(frame: VideoFrame, files: VideoInputs): string {
	const { box, bounds } = frame;
	const withMask = Boolean(frame.masked && files.mask);
	const base = withMask ? 3 : 2;
	const count = frame.segments.length;
	const sound = audible(frame, files);
	const anySound = sound.some(Boolean);
	// As fontes de silêncio vêm DEPOIS dos trechos, uma por trecho mudo.
	const silenceBase = base + count;

	const steps: string[] = [];

	// 1. A máscara é UMA imagem usada por todos os trechos, e um filtro só pode
	//    ser consumido uma vez — daí o `split`.
	if (withMask) {
		steps.push(
			count === 1
				? "[2:v]alphaextract[mask0]"
				: `[2:v]alphaextract,split=${count}${labels("mask", count)}`,
		);
	}

	// 3. Cada trecho preenchendo a caixa: amplia até COBRI-LA e corta o excedente
	//    no ponto focal. É a mesma conta do `focalCropTo` — centrar no ponto e
	//    empurrar para dentro quando ele está na borda —, escrita como expressão
	//    para o ffmpeg resolver com o tamanho real do arquivo. Assim o portal não
	//    precisa abrir o vídeo para medi-lo.
	//
	//    `setsar=1` é o detalhe que economiza uma tarde: muito vídeo de celular
	//    vem com pixel não-quadrado, e sem isto a caixa sai com a largura certa e
	//    a imagem espremida dentro dela. `fps` iguala a cadência, que o `concat`
	//    exige.
	let silentSeen = 0;
	frame.segments.forEach((_segment, index) => {
		const input = base + index;
		steps.push(
			`[${input}:v]scale=${box.width}:${box.height}:force_original_aspect_ratio=increase,` +
				`crop=${box.width}:${box.height}:` +
				`${focalOffset("w", frame.focal.x)}:${focalOffset("h", frame.focal.y)},` +
				`setsar=1,fps=${OUTPUT_FPS},format=rgba[v${index}]`,
		);
		if (withMask) {
			steps.push(`[v${index}][mask${index}]alphamerge[v${index}]`);
		}
		// A rotação da caixa, quando o padrão a girou. `c=none` só preenche com
		// transparência porque o passo acima já pôs o trecho em RGBA.
		if (frame.rotation !== 0) {
			const radians = round((frame.rotation * Math.PI) / 180, 6);
			steps.push(
				`[v${index}]rotate=${radians}:c=none:ow=${Math.round(bounds.width)}:` +
					`oh=${Math.round(bounds.height)}[v${index}]`,
			);
		}
		if (anySound) {
			// O som do trecho, ou o silêncio da fonte própria dele.
			const source = sound[index]
				? `${input}:a`
				: `${silenceBase + silentSeen++}:a`;
			steps.push(`[${source}]${AUDIO_FORMAT},asetpts=PTS-STARTPTS[a${index}]`);
		}
	});

	// 4. A emenda. Vídeo e áudio no MESMO `concat`, intercalados, que é o que
	//    mantém os dois em sincronia — emendá-los em dois grafos separados deixa
	//    a voz andando na frente da imagem a cada corte.
	const parts = frame.segments
		.map((_, index) => (anySound ? `[v${index}][a${index}]` : `[v${index}]`))
		.join("");
	if (count > 1) {
		steps.push(
			`${parts}concat=n=${count}:v=1:a=${anySound ? 1 : 0}[vid]${anySound ? "[aud]" : ""}`,
		);
	} else {
		steps.push("[v0]null[vid]");
		if (anySound) {
			steps.push("[a0]anull[aud]");
		}
	}

	// 5. A pilha. `shortest=1` no primeiro empilhamento é o que faz o fundo
	//    infinito parar junto com o vídeo.
	const left = Math.round(frame.rotation === 0 ? box.x : bounds.x);
	const top = Math.round(frame.rotation === 0 ? box.y : bounds.y);
	steps.push(`[0:v][vid]overlay=${left}:${top}:shortest=1:format=auto[base]`);
	steps.push("[base][1:v]overlay=0:0:format=auto,format=yuv420p[out]");
	if (anySound) {
		steps.push("[aud]anull[aout]");
	}

	return steps.join(";");
}

/**
 * Descobre, na conversa do ffmpeg, se o arquivo tem trilha de áudio.
 *
 * Sai daqui, e não de um `ffprobe`, porque o `ffprobe` é OUTRO binário de
 * oitenta megabytes para responder uma pergunta de sim ou não — e o deploy já
 * carrega três binários nativos. O ffmpeg escreve a lista de faixas no `stderr`
 * de qualquer invocação; basta lê-la.
 *
 * Parser separado da chamada, e puro, porque é a parte que quebra em silêncio:
 * um falso negativo aqui publica o Reels mudo, sem erro nenhum no caminho.
 */
export function hasAudioStream(stderr: string): boolean {
	return /^\s*Stream #\d+:\d+.*: Audio:/m.test(stderr);
}

/**
 * O deslocamento do corte num eixo, como expressão do ffmpeg.
 *
 * `max(0, min(in-out, f*in - out/2))`: o meio do quadro no ponto focal, preso
 * dentro da imagem. As vírgulas vão escapadas porque, no `filter_complex`, a
 * vírgula crua separaria dois filtros.
 */
function focalOffset(axis: "w" | "h", fraction: number): string {
	const f = round(fraction, 4);
	return `max(0\\,min(in_${axis}-out_${axis}\\,${f}*in_${axis}-out_${axis}/2))`;
}

/** `[nome0][nome1]…` — os rótulos de saída de um `split`. */
function labels(name: string, count: number): string {
	return Array.from({ length: count }, (_, i) => `[${name}${i}]`).join("");
}

/** Sem casas sobrando: `-ss 3.0000000000000004` é o que o ponto flutuante dá. */
function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}
