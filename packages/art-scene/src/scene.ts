import {
	type ArtContent,
	type ArtDesign,
	type ArtElement,
	type ArtFormat,
	type ArtInputs,
	canvasOf,
	type Fill,
	type Focal,
	focalCropTo,
	type ImageElement,
	NO_INPUTS,
	type PhotoElement,
	type Shadow,
	type Stroke,
	type TextElement,
	type TextStyle,
	textFor,
} from "@portal-app/social";
import type KonvaNamespace from "konva";

/**
 * Padrão de arte → nós Konva (spec 10, D1).
 *
 * **O Konva entra por parâmetro**, e não por `import`. No servidor, quem
 * desenha é o Konva com o backend do skia-canvas, que troca a fábrica de canvas
 * DA INSTÂNCIA que ele importou; se este pacote importasse a sua própria cópia
 * (o pnpm pode instalar duas), a cena sairia de uma instância sem canvas. Quem
 * chama — o editor, o desenhista do servidor — passa a instância que configurou.
 *
 * Tudo aqui é desenho: nada de seleção, arraste ou estado de tela. O editor
 * embrulha estes nós com a interação; o servidor só os rasteriza.
 */

export type Konva = typeof KonvaNamespace;
type KGroup = InstanceType<Konva["Group"]>;
type KLayer = InstanceType<Konva["Layer"]>;
type KText = InstanceType<Konva["Text"]>;
type KShape = InstanceType<Konva["Shape"]>;

/** Uma imagem pronta para o canvas, com o tamanho natural. */
export type LoadedImage = {
	image: CanvasImageSource;
	width: number;
	height: number;
};

export type SceneAssets = {
	/** A foto do post, com o ponto focal. `null` desenha o lugar em cinza. */
	photo: (LoadedImage & { focal: Focal }) | null;
	/** Molduras e logos já carregados, por id da mídia. */
	images: Readonly<Record<string, LoadedImage>>;
};

export const NO_ASSETS: SceneAssets = { photo: null, images: {} };

export type SceneOptions = {
	/**
	 * Desenhar os invisíveis (o editor mostra a camada oculta apagada, e quem
	 * esconde é ele) e marcar a imagem que ainda não carregou.
	 */
	editor?: boolean;
};

export type SceneInput = {
	format: ArtFormat;
	design: ArtDesign;
	content: ArtContent;
	inputs?: ArtInputs;
	assets?: SceneAssets;
	options?: SceneOptions;
};

/** O cinza do lugar da foto, quando ainda não há foto. */
export const PHOTO_PLACEHOLDER = "#9ca3af";
/** O nome dos grupos de elemento — é por ele que o editor os acha no palco. */
export const ELEMENT_NODE = "art-element";

// ── a cena inteira ─────────────────────────────────────────────────────────

/**
 * A camada com o quadro inteiro: o fundo e cada elemento NA ORDEM da pilha.
 * Devolve também os avisos de texto que não coube nem no tamanho mínimo (D8).
 */
export function buildArtLayer(
	K: Konva,
	input: SceneInput,
): { layer: KLayer; warnings: string[] } {
	const { width, height } = canvasOf(input.format);
	const layer = new K.Layer({ listening: Boolean(input.options?.editor) });
	layer.add(
		new K.Rect({
			name: "art-background",
			x: 0,
			y: 0,
			width,
			height,
			fill: input.design.background,
			listening: false,
		}),
	);
	const warnings: string[] = [];
	for (const element of input.design.elements) {
		if (!element.visible && !input.options?.editor) {
			continue;
		}
		const built = buildElementNode(K, element, input);
		if (built.warning) {
			warnings.push(built.warning);
		}
		layer.add(built.node);
	}
	return { layer, warnings };
}

/**
 * Um elemento como grupo Konva: posicionado pelo CENTRO (é em torno dele que a
 * rotação gira — D7), com os filhos em coordenadas locais de 0 a largura/altura.
 *
 * Todo grupo leva primeiro um retângulo transparente do tamanho da caixa. É ele
 * que dá ao grupo o tamanho da caixa — sem ele, uma caixa de texto vazia teria
 * tamanho zero e as alças do editor não teriam onde se prender.
 */
export function buildElementNode(
	K: Konva,
	element: ArtElement,
	input: Omit<SceneInput, "format">,
): { node: KGroup; warning: string | null } {
	const { width, height } = element;
	const group = new K.Group({
		id: element.id,
		name: ELEMENT_NODE,
		x: element.x + width / 2,
		y: element.y + height / 2,
		offsetX: width / 2,
		offsetY: height / 2,
		rotation: element.rotation,
		opacity: element.visible ? element.opacity : element.opacity * 0.3,
	});
	group.add(
		new K.Rect({
			name: "art-frame",
			width,
			height,
			fill: "rgba(0,0,0,0)",
		}),
	);

	let warning: string | null = null;
	switch (element.kind) {
		case "PHOTO":
			group.add(photoNode(K, element, input.assets ?? NO_ASSETS));
			break;
		case "IMAGE": {
			const node = imageNode(
				K,
				element,
				input.assets ?? NO_ASSETS,
				Boolean(input.options?.editor),
			);
			if (node) {
				group.add(node);
			}
			break;
		}
		case "RECT":
			group.add(
				new K.Rect({
					width,
					height,
					cornerRadius: element.cornerRadius,
					...fillAttrs(element.fill, width, height, 0, 0),
					...strokeAttrs(element.stroke),
					...shadowAttrs(element.shadow),
				}),
			);
			break;
		case "ELLIPSE":
			group.add(
				new K.Ellipse({
					x: width / 2,
					y: height / 2,
					radiusX: width / 2,
					radiusY: height / 2,
					...fillAttrs(element.fill, width, height, -width / 2, -height / 2),
					...strokeAttrs(element.stroke),
					...shadowAttrs(element.shadow),
				}),
			);
			break;
		case "LINE":
			group.add(
				new K.Line({
					points: [0, height / 2, width, height / 2],
					stroke: element.stroke.color,
					strokeWidth: element.stroke.width,
					lineCap: "round",
				}),
			);
			break;
		case "TEXT": {
			const text = textFor(
				element,
				input.design,
				input.content,
				input.inputs ?? NO_INPUTS,
			);
			const built = textNodes(K, element, text);
			group.add(...built.nodes);
			if (!built.fitted.fits) {
				warning = overflowWarning(element);
			}
			break;
		}
	}
	return { node: group, warning };
}

// ── imagens ────────────────────────────────────────────────────────────────

function photoNode(
	K: Konva,
	element: PhotoElement,
	assets: SceneAssets,
): KShape {
	const { width, height, cornerRadius } = element;
	const photo = assets.photo;
	if (!photo) {
		return new K.Rect({
			width,
			height,
			cornerRadius,
			fill: PHOTO_PLACEHOLDER,
			...strokeAttrs(element.stroke),
		});
	}
	const crop = focalCropTo(photo, photo.focal, { width, height });
	return new K.Image({
		image: photo.image,
		width,
		height,
		cornerRadius,
		crop: { x: crop.left, y: crop.top, width: crop.width, height: crop.height },
		...strokeAttrs(element.stroke),
	});
}

function imageNode(
	K: Konva,
	element: ImageElement,
	assets: SceneAssets,
	editor: boolean,
): KShape | null {
	const { width, height, cornerRadius } = element;
	const loaded = assets.images[element.mediaId];
	if (!loaded) {
		// No servidor, moldura que sumiu some do desenho; no editor, a caixa
		// continua visível para ser trocada.
		return editor
			? new K.Rect({
					width,
					height,
					cornerRadius,
					stroke: PHOTO_PLACEHOLDER,
					strokeWidth: 4,
					dash: [16, 12],
				})
			: null;
	}
	if (element.fit === "stretch") {
		return new K.Image({ image: loaded.image, width, height, cornerRadius });
	}
	if (element.fit === "cover") {
		const crop = focalCropTo(loaded, { x: 0.5, y: 0.5 }, { width, height });
		return new K.Image({
			image: loaded.image,
			width,
			height,
			cornerRadius,
			crop: {
				x: crop.left,
				y: crop.top,
				width: crop.width,
				height: crop.height,
			},
		});
	}
	const box = containBox(loaded, { width, height });
	return new K.Image({ image: loaded.image, ...box, cornerRadius });
}

/** A imagem inteira dentro da caixa, centralizada. */
export function containBox(
	image: { width: number; height: number },
	box: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
	const scale = Math.min(
		box.width / Math.max(1, image.width),
		box.height / Math.max(1, image.height),
	);
	const width = image.width * scale;
	const height = image.height * scale;
	return {
		x: (box.width - width) / 2,
		y: (box.height - height) / 2,
		width,
		height,
	};
}

// ── preenchimento, contorno e sombra ───────────────────────────────────────

/**
 * Os pontos do degradê linear para um ângulo, cobrindo a caixa inteira: a
 * linha passa pelo centro, e as pontas ficam onde a primeira e a última cor
 * encostam nos cantos — como o `linear-gradient` do CSS.
 */
export function gradientPoints(
	angle: number,
	width: number,
	height: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
	const radians = (angle * Math.PI) / 180;
	const dx = Math.cos(radians);
	const dy = Math.sin(radians);
	const half = Math.abs((width / 2) * dx) + Math.abs((height / 2) * dy);
	const cx = width / 2;
	const cy = height / 2;
	return {
		start: { x: cx - dx * half, y: cy - dy * half },
		end: { x: cx + dx * half, y: cy + dy * half },
	};
}

function fillAttrs(
	fill: Fill,
	width: number,
	height: number,
	originX: number,
	originY: number,
): Record<string, unknown> {
	if (fill.type === "solid") {
		return { fill: fill.color };
	}
	const { start, end } = gradientPoints(fill.angle, width, height);
	return {
		fillPriority: "linear-gradient",
		fillLinearGradientStartPoint: {
			x: start.x + originX,
			y: start.y + originY,
		},
		fillLinearGradientEndPoint: { x: end.x + originX, y: end.y + originY },
		fillLinearGradientColorStops: fill.stops.flatMap((stop) => [
			stop.offset,
			stop.color,
		]),
	};
}

function strokeAttrs(stroke: Stroke | null): Record<string, unknown> {
	return stroke && stroke.width > 0
		? { stroke: stroke.color, strokeWidth: stroke.width }
		: {};
}

function shadowAttrs(shadow: Shadow | null): Record<string, unknown> {
	return shadow
		? {
				shadowEnabled: true,
				shadowColor: shadow.color,
				shadowBlur: shadow.blur,
				shadowOffsetX: shadow.offsetX,
				shadowOffsetY: shadow.offsetY,
				shadowOpacity: shadow.opacity,
			}
		: {};
}

// ── texto (D8) ─────────────────────────────────────────────────────────────

export type FittedText = {
	/** O tamanho escolhido. */
	fontSize: number;
	/** Quantas linhas saem nesse tamanho (já contando o corte). */
	lines: number;
	/** Coube sem cortar? `false` sai com reticências. */
	fits: boolean;
};

const STEP = 2;

/** O `fontStyle` do Konva: "italic 800", "800". */
export function fontStyleOf(style: TextStyle): string {
	return `${style.italic ? "italic " : ""}${style.fontWeight}`;
}

/** A área útil da caixa, descontado o respiro do fundo. */
function usable(element: TextElement): {
	width: number;
	height: number;
	paddingX: number;
	paddingY: number;
} {
	const paddingX = element.style.background?.paddingX ?? 0;
	const paddingY = element.style.background?.paddingY ?? 0;
	return {
		width: Math.max(1, element.width - 2 * paddingX),
		height: Math.max(1, element.height - 2 * paddingY),
		paddingX,
		paddingY,
	};
}

function measuredText(
	K: Konva,
	element: TextElement,
	text: string,
	fontSize: number,
	width: number,
): KText {
	const { style } = element;
	return new K.Text({
		text,
		width,
		fontSize,
		fontFamily: style.fontFamily,
		fontStyle: fontStyleOf(style),
		lineHeight: style.lineHeight,
		letterSpacing: style.letterSpacing,
		align: style.align,
		wrap: "word",
		fill: style.color,
	});
}

/**
 * O maior tamanho, do cheio ao mínimo, em que o texto cabe na caixa — medido
 * pelo próprio `Konva.Text`, com a fonte de verdade (D8). O mínimo é tentado
 * sempre, mesmo quando o passo pula por cima dele.
 */
export function fitText(
	K: Konva,
	element: TextElement,
	text: string,
): FittedText {
	const { style } = element;
	if (text.trim() === "") {
		return { fontSize: style.fontSize, lines: 0, fits: true };
	}
	const area = usable(element);
	const attempt = (fontSize: number): FittedText => {
		const node = measuredText(K, element, text, fontSize, area.width);
		const lines = node.textArr.length;
		const fits =
			lines <= style.maxLines &&
			lines * fontSize * style.lineHeight <= area.height + 0.5;
		node.destroy();
		return { fontSize, lines, fits };
	};
	for (let size = style.fontSize; size > style.minFontSize; size -= STEP) {
		const result = attempt(size);
		if (result.fits) {
			return result;
		}
	}
	return attempt(style.minFontSize);
}

/**
 * Os nós do texto: a pílula ou a caixa de fundo, se houver, e o texto — já no
 * tamanho que cabe, posicionado pelo alinhamento vertical e cortado com
 * reticências se nem no mínimo couber.
 */
export function textNodes(
	K: Konva,
	element: TextElement,
	text: string,
): { nodes: KShape[]; fitted: FittedText } {
	const { style } = element;
	const fitted = fitText(K, element, text);
	if (text.trim() === "") {
		// Caixa vazia não desenha nada — nem a pílula (D2).
		return { nodes: [], fitted };
	}
	const area = usable(element);
	const lineBox = fitted.fontSize * style.lineHeight;
	const maxLines = Math.max(
		1,
		Math.min(style.maxLines, Math.floor((area.height + 0.5) / lineBox)),
	);

	const node = measuredText(K, element, text, fitted.fontSize, area.width);
	if (!fitted.fits) {
		node.height(maxLines * lineBox);
		node.ellipsis(true);
	}
	const lines = Math.min(node.textArr.length, maxLines);
	const contentHeight = lines * lineBox;
	const free = area.height - contentHeight;
	const top =
		area.paddingY +
		(style.verticalAlign === "middle"
			? free / 2
			: style.verticalAlign === "bottom"
				? free
				: 0);
	node.position({ x: area.paddingX, y: top });
	node.setAttrs({
		...(style.stroke && style.stroke.width > 0
			? {
					stroke: style.stroke.color,
					strokeWidth: style.stroke.width,
					fillAfterStrokeEnabled: true,
				}
			: {}),
		...shadowAttrs(style.shadow),
	});

	const nodes: KShape[] = [];
	const background = style.background;
	if (background) {
		if (background.shape === "box") {
			nodes.push(
				new K.Rect({
					width: element.width,
					height: element.height,
					fill: background.color,
					cornerRadius: background.radius,
				}),
			);
		} else {
			const hugWidth =
				Math.min(node.getTextWidth(), area.width) + 2 * background.paddingX;
			const x =
				style.align === "center"
					? (element.width - hugWidth) / 2
					: style.align === "right"
						? element.width - hugWidth
						: 0;
			nodes.push(
				new K.Rect({
					x,
					y: top - background.paddingY,
					width: hugWidth,
					height: contentHeight + 2 * background.paddingY,
					fill: background.color,
					cornerRadius: background.radius,
				}),
			);
		}
	}
	nodes.push(node);
	return { nodes, fitted: { ...fitted, lines } };
}

function overflowWarning(element: TextElement): string {
	const name =
		element.name.trim() ||
		element.fieldLabel.trim() ||
		element.content.trim().slice(0, 30) ||
		"Um texto";
	return `"${name}" não cabe nem no tamanho mínimo e vai sair cortado.`;
}

/** Os avisos de texto que não cabe, sem montar a cena inteira. */
export function textWarnings(
	K: Konva,
	input: Omit<SceneInput, "format" | "assets">,
): string[] {
	return input.design.elements
		.filter(
			(element): element is TextElement =>
				element.kind === "TEXT" && element.visible,
		)
		.filter(
			(element) =>
				!fitText(
					K,
					element,
					textFor(
						element,
						input.design,
						input.content,
						input.inputs ?? NO_INPUTS,
					),
				).fits,
		)
		.map(overflowWarning);
}
