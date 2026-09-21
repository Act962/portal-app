import {
	DESTINATION_LABEL,
	PLATFORM_LIMITS,
	type SocialDestination,
} from "./platform";

/**
 * O vídeo de um post: a SEQUÊNCIA de trechos que a redação montou (spec 12).
 *
 * Só aritmética e frases — nenhuma biblioteca de vídeo, nenhum I/O. É de
 * propósito, e pelo mesmo motivo do `focal-crop`: um recorte errado não lança
 * exceção nenhuma, só publica no Instagram um Reels que começa no meio da
 * palavra. Função pura se prova com tabela de casos; o ffmpeg só executa o que
 * ela decidiu.
 */

/**
 * Um trecho aproveitado de um arquivo da biblioteca.
 *
 * `sourceSeconds` é uma CÓPIA da duração do arquivo, tirada quando o vídeo foi
 * escolhido — a mesma decisão do `artContent`, e pelo mesmo motivo: o post
 * aprovado precisa poder responder sozinho se o que ele montou cabe, sem ir
 * buscar o arquivo.
 *
 * **O mesmo arquivo pode aparecer em vários trechos** — pegar dois momentos de
 * uma entrevista é o caso normal, não a exceção.
 */
export type VideoClip = {
	/** O id na biblioteca de mídia. */
	mediaId: string;
	/** A duração do arquivo inteiro, em segundos. */
	sourceSeconds: number;
	/** Onde o trecho começa, em segundos a partir do início do arquivo. */
	startSeconds: number;
	/** Onde o trecho termina. Sempre maior que `startSeconds`. */
	endSeconds: number;
	/** Publicar sem áudio. Vídeo de redação costuma ter ruído de rua atrás. */
	muted: boolean;
};

/**
 * O vídeo do post inteiro: os trechos NA ORDEM em que vão ao ar.
 *
 * Lista, e não um trecho só, porque a montagem de portal quase nunca é um corte
 * único: é a declaração do prefeito, o corte para a rua alagada, a volta. Lista
 * VAZIA não existe como estado — um post sem trechos é um post sem vídeo, e o
 * agregado guarda `[]` como "não é post de vídeo".
 */
export type VideoSequence = readonly VideoClip[];

/**
 * O teto de duração do PORTAL, em segundos.
 *
 * Não é limite do Instagram (o Reels aceita 15 minutos): é limite do nosso
 * renderizador. Compor o padrão sobre o vídeo é transcodificação, roda numa
 * função com tempo máximo de execução, e um vídeo de dez minutos estoura esse
 * tempo — a entrega ficaria repetindo para sempre sem nunca terminar. Noventa
 * segundos é o dobro do Reels típico de portal e cabe com folga.
 *
 * Vale para a SOMA dos trechos: o que custa a montagem é o vídeo final, não
 * quantos pedaços o formaram.
 *
 * Subir este número exige mover a renderização para fora da função (uma fila
 * com máquina própria), não só trocar a constante.
 */
export const RENDER_MAX_SECONDS = 90;

/** O menor vídeo publicável — é o mínimo do Reels, e vale para a SOMA. */
export const MIN_SEQUENCE_SECONDS = 3;

/**
 * O menor trecho que a barra de corte deixa existir.
 *
 * Meio segundo, e não os três do mínimo publicável: num corte encadeado, um
 * pedaço de um segundo é edição legítima — quem precisa ter três segundos é o
 * vídeo inteiro. Confundir os dois faria a barra travar num trecho perfeitamente
 * válido.
 */
export const MIN_CLIP_SECONDS = 0.5;

/**
 * Quantos trechos cabem num post.
 *
 * Cada trecho é uma entrada do ffmpeg e um pedaço a mais no grafo de filtros. O
 * teto existe para o grafo não crescer sem limite; doze cortes já é mais do que
 * qualquer Reels de portal usa.
 */
export const MAX_CLIPS = 12;

/** Quanto tempo um trecho dura. */
export function clipDuration(clip: VideoClip): number {
	return Math.max(0, clip.endSeconds - clip.startSeconds);
}

/** Quanto tempo o vídeo montado dura — a soma dos trechos. */
export function sequenceDuration(clips: VideoSequence): number {
	return clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

/**
 * Onde cada trecho começa NO VÍDEO MONTADO, em segundos.
 *
 * É o que a linha do tempo da tela usa para desenhar as faixas lado a lado, e o
 * que o tocador usa para saber em qual trecho está. Fica aqui, e não na tela,
 * porque é a mesma conta que decide a ordem dos segmentos no ffmpeg.
 */
export function clipOffsets(clips: VideoSequence): number[] {
	const offsets: number[] = [];
	let elapsed = 0;
	for (const clip of clips) {
		offsets.push(elapsed);
		elapsed += clipDuration(clip);
	}
	return offsets;
}

/** O trecho inteiro de um arquivo recém-escolhido, sem nada aparado. */
export function wholeClip(
	mediaId: string,
	sourceSeconds: number,
	muted = false,
): VideoClip {
	const source = Math.max(0, sourceSeconds);
	return {
		mediaId,
		sourceSeconds: source,
		startSeconds: 0,
		// O arquivo pode ser mais longo que o teto do portal; o trecho nasce
		// aparado no teto em vez de nascer inválido.
		endSeconds: Math.min(source, RENDER_MAX_SECONDS),
		muted,
	};
}

/**
 * O mesmo trecho com as pontas dentro do arquivo e na ordem certa.
 *
 * Aparar em vez de recusar é o que faz o controle deslizante da tela funcionar:
 * arrastar o fim para além do arquivo para no fim do arquivo, não devolve erro.
 * O que NÃO se conserta aqui — vídeo curto demais, longo demais — vira frase em
 * `sequenceProblems`, porque aí a redação precisa decidir.
 */
export function normalizeClip(clip: VideoClip): VideoClip {
	const source = Math.max(0, clip.sourceSeconds);
	const start = clamp(clip.startSeconds, 0, source);
	const end = clamp(clip.endSeconds, start, source);
	return {
		...clip,
		sourceSeconds: source,
		startSeconds: start,
		endSeconds: end,
	};
}

/**
 * A sequência aparada: cada trecho dentro do seu arquivo, os vazios fora e o
 * excedente de trechos cortado no teto.
 *
 * Trecho de duração zero é DESCARTADO em vez de virar problema: ele aparece
 * quando alguém arrasta as duas alças para o mesmo ponto, e o certo ali é a
 * faixa sumir, não a tela travar com um erro.
 */
export function normalizeSequence(clips: VideoSequence): VideoClip[] {
	return clips
		.map(normalizeClip)
		.filter((clip) => clipDuration(clip) > 0)
		.slice(0, MAX_CLIPS);
}

/**
 * Tudo o que está errado neste vídeo para estes destinos, em frases para a
 * tela. Lista vazia é vídeo publicável.
 *
 * Mede a SOMA, não cada trecho: o Instagram recebe um arquivo só, e é a
 * duração dele que as redes limitam.
 */
export function sequenceProblems(
	clips: VideoSequence,
	destinations: readonly SocialDestination[],
): string[] {
	const problems: string[] = [];
	const duration = sequenceDuration(clips);

	if (clips.length === 0 || !Number.isFinite(duration) || duration <= 0) {
		problems.push("Escolha o trecho do vídeo que vai ao ar.");
		return problems;
	}
	if (clips.length > MAX_CLIPS) {
		problems.push(`Um vídeo aceita até ${MAX_CLIPS} trechos.`);
	}
	if (duration < MIN_SEQUENCE_SECONDS) {
		problems.push(
			`O vídeo tem ${formatSeconds(duration)} e o mínimo é de ${MIN_SEQUENCE_SECONDS} segundos.`,
		);
	}
	if (duration > RENDER_MAX_SECONDS) {
		problems.push(
			`O vídeo tem ${formatSeconds(duration)} e o portal monta vídeos de até ${formatSeconds(RENDER_MAX_SECONDS)}. Aparte um trecho ou tire um.`,
		);
	}

	for (const destination of destinations) {
		const window = PLATFORM_LIMITS[destination].videoSeconds;
		const label = DESTINATION_LABEL[destination];
		if (!window) {
			problems.push(`O ${label} não publica vídeo.`);
			continue;
		}
		if (duration > window.max) {
			problems.push(
				`O vídeo tem ${formatSeconds(duration)} e o ${label} aceita até ${formatSeconds(window.max)}.`,
			);
		}
		if (duration < window.min) {
			problems.push(
				`O vídeo tem ${formatSeconds(duration)} e o ${label} pede ao menos ${formatSeconds(window.min)}.`,
			);
		}
	}
	return problems;
}

/**
 * A duração como a tela a escreve: `1:04`, `12s`. Fica no domínio porque as
 * frases de problema acima a usam, e mensagem de erro que arredonda diferente
 * da linha do tempo é a que faz alguém procurar um bug que não existe.
 */
export function formatSeconds(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	if (total < 60) {
		return `${total}s`;
	}
	const minutes = Math.floor(total / 60);
	return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) {
		return min;
	}
	return Math.min(Math.max(value, min), max);
}
