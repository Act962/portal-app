import type { Focal, Size } from "../focal-crop";
import { clipDuration, type VideoClip, type VideoSequence } from "../video";
import {
	type ArtDesign,
	type ArtElement,
	type ArtFormat,
	canvasOf,
	type PhotoElement,
	rotatedBounds,
} from "./art-template";

/**
 * Onde o vídeo entra no padrão (spec 12, D2) — só aritmética, nenhum ffmpeg.
 *
 * O padrão de arte não ganhou um elemento novo para o vídeo: o vídeo ocupa o
 * MESMO lugar de foto que já existe. Isso é decisão de produto, não economia de
 * código — quem desenha um padrão desenha um só, e a redação escolhe depois se
 * aquele quadro recebe a foto do dia ou o vídeo da entrevista. Padrão 9:16 feito
 * para os Stories serve ao Reels sem ninguém redesenhar nada.
 *
 * A consequência é esta divisão em três: o que está EMBAIXO do lugar da foto na
 * pilha vira uma imagem de fundo, o vídeo entra no meio, e o que está EM CIMA
 * vira uma imagem com transparência. O ffmpeg só empilha as três.
 */

/** Um trecho, já reduzido ao que o ffmpeg precisa saber. */
export type VideoSegment = {
	mediaId: string;
	startSeconds: number;
	durationSeconds: number;
	muted: boolean;
};

export type VideoFrame = {
	/** O quadro final, em pixels — 1080×1920 nos formatos em pé. */
	canvas: Size;
	/**
	 * A caixa do vídeo no quadro, ANTES da rotação; `x/y` é o canto superior
	 * esquerdo, como em todo elemento.
	 */
	box: { x: number; y: number; width: number; height: number };
	/** A caixa alinhada aos eixos que contém a caixa girada. */
	bounds: { x: number; y: number; width: number; height: number };
	/** Graus, em torno do centro da caixa. */
	rotation: number;
	cornerRadius: number;
	/**
	 * O ponto focal com que o vídeo preenche a caixa.
	 *
	 * Vai como FRAÇÃO, e não como um retângulo de recorte em pixels, porque o
	 * portal não mede o arquivo: medir exigiria abrir o vídeo no servidor só
	 * para calcular uma conta que o próprio ffmpeg faz com `in_w`/`in_h`. A
	 * conta é a mesma do `focalCropTo` — centrar no ponto e empurrar para dentro
	 * quando ele está perto da borda.
	 */
	focal: Focal;
	/**
	 * Os trechos, na ordem em que vão ao ar — um por entrada do ffmpeg.
	 *
	 * O QUADRO é um só (a caixa, a rotação, o arredondamento não mudam de um
	 * trecho para o outro); o que varia é qual pedaço de qual arquivo entra nele.
	 * Por isso os trechos ficam numa lista aqui dentro, e não num `VideoFrame`
	 * por trecho: repetir o quadro N vezes abriria a porta para N quadros
	 * discordantes.
	 */
	segments: readonly VideoSegment[];
	/**
	 * O desenho de baixo (fundo do quadro + o que está sob o lugar da foto) e o
	 * de cima. O de cima leva o lugar da foto virado só-contorno, para a moldura
	 * e o canto arredondado ficarem sobre o vídeo, e não atrás dele.
	 */
	under: ArtDesign;
	over: ArtDesign;
	/**
	 * O vídeo precisa de máscara? Só com canto arredondado — sem ela, os cantos
	 * quadrados do vídeo apareceriam por cima do fundo. Rotação e máscara são as
	 * duas únicas coisas que encarecem a composição, e o caso comum não tem
	 * nenhuma das duas.
	 */
	masked: boolean;
};

/** O lugar da foto de um desenho e onde ele está na pilha. */
function photoSlot(
	design: ArtDesign,
): { element: PhotoElement; index: number } | null {
	const index = design.elements.findIndex(
		(element) => element.kind === "PHOTO" && element.visible,
	);
	return index === -1
		? null
		: { element: design.elements[index] as PhotoElement, index };
}

/**
 * O lugar da foto como CONTORNO: a mesma caixa, sem preenchimento, guardando o
 * traço e o arredondamento.
 *
 * `#00000000` é preto com alfa zero — a validação do padrão já aceita a forma
 * de oito dígitos, e o canvas a desenha como nada. É o que permite pôr a
 * moldura do lugar da foto por cima do vídeo sem reimplementar o desenho dela.
 */
function photoAsOutline(element: PhotoElement): ArtElement {
	return {
		id: element.id,
		name: element.name,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation,
		opacity: element.opacity,
		visible: true,
		locked: element.locked,
		kind: "RECT",
		fill: { type: "solid", color: "#00000000" },
		cornerRadius: element.cornerRadius,
		stroke: element.stroke,
		shadow: null,
	};
}

/**
 * O plano de composição de um vídeo neste padrão.
 *
 * Sem lugar de foto no desenho, o vídeo ocupa o QUADRO INTEIRO e todo o resto
 * fica por cima. É o comportamento que faz um padrão de moldura — só a faixa
 * vermelha e o logo, sem caixa de foto — servir ao vídeo sem ser redesenhado.
 */
export function videoFrameFor(input: {
	format: ArtFormat;
	design: ArtDesign;
	/** O ponto focal do arquivo; o centro quando não há. */
	focal?: Focal;
	clips: VideoSequence;
}): VideoFrame {
	const canvas = canvasOf(input.format);
	const slot = photoSlot(input.design);
	const focal = input.focal ?? { x: 0.5, y: 0.5 };

	const box = slot
		? {
				x: slot.element.x,
				y: slot.element.y,
				width: Math.max(1, Math.round(slot.element.width)),
				height: Math.max(1, Math.round(slot.element.height)),
			}
		: { x: 0, y: 0, width: canvas.width, height: canvas.height };
	const rotation = slot ? slot.element.rotation : 0;
	const cornerRadius = slot ? Math.max(0, slot.element.cornerRadius) : 0;

	return {
		canvas,
		box,
		bounds: rotatedBounds({ ...box, rotation }),
		rotation,
		cornerRadius,
		focal: { x: clampUnit(focal.x), y: clampUnit(focal.y) },
		segments: input.clips.map((clip: VideoClip) => ({
			mediaId: clip.mediaId,
			startSeconds: clip.startSeconds,
			durationSeconds: clipDuration(clip),
			muted: clip.muted,
		})),
		under: {
			background: input.design.background,
			variables: input.design.variables,
			elements: slot ? input.design.elements.slice(0, slot.index) : [],
		},
		over: {
			// O de cima é transparente: o fundo do quadro já foi desenhado embaixo.
			background: "#00000000",
			variables: input.design.variables,
			elements: slot
				? [
						photoAsOutline(slot.element),
						...input.design.elements.slice(slot.index + 1),
					]
				: input.design.elements,
		},
		masked: cornerRadius > 0,
	};
}

function clampUnit(value: number): number {
	if (!Number.isFinite(value)) {
		return 0.5;
	}
	return Math.min(Math.max(value, 0), 1);
}
