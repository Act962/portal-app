import {
	type ArtDesign,
	type ArtElement,
	type ArtFormat,
	canvasOf,
	DEFAULT_TEXT_STYLE,
	type ElementBase,
	type ElementKind,
	rotatedBounds,
	SYSTEM_VARIABLE_KEYS,
	TEMPLATE_FONTS,
	type TemplateFontFamily,
	type TemplateFontSpec,
	type TemplateVariable,
	type TextMode,
	type TextStyle,
} from "@portal-app/social";

/**
 * A lógica do editor de padrões (spec 10, F3–F4), SEM JSX, SEM React e SEM
 * Konva (regra de testes do projeto).
 *
 * O palco Konva só mostra e captura gestos; toda mudança no desenho — criar,
 * alinhar, reordenar, colar, desfazer, encaixar nas guias — é uma função pura
 * daqui, que recebe o desenho e devolve o próximo. É o que torna cada gesto
 * testável sem montar tela, e o que faz o desfazer ser só guardar desenhos.
 */

export type Bounds = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export const KIND_LABEL: Record<ElementKind, string> = {
	PHOTO: "Foto da matéria",
	IMAGE: "Imagem",
	RECT: "Retângulo",
	ELLIPSE: "Elipse",
	LINE: "Linha",
	TEXT: "Texto",
};

export const MODE_LABEL: Record<TextMode, string> = {
	STATIC: "Estático",
	DYNAMIC: "Dinâmico",
	EDITABLE: "Editável na matéria",
};

export const MODE_HINT: Record<TextMode, string> = {
	STATIC: "Texto fixo do padrão. As chaves {{ }} saem como estão.",
	DYNAMIC:
		"Preenchido pelas variáveis. A redação não mexe nesta caixa no post.",
	EDITABLE:
		"Preenchido pelas variáveis, e a redação pode trocar o texto em cada post.",
};

export const WEIGHT_LABEL: Record<number, string> = {
	400: "Regular",
	500: "Médio",
	600: "Seminegrito",
	700: "Negrito",
	800: "Extranegrito",
	900: "Black",
};

export const FORMAT_LABEL: Record<ArtFormat, string> = {
	"1:1": "1:1 — quadrado (feed)",
	"4:5": "4:5 — retrato (feed)",
	"9:16": "9:16 — tela cheia (Stories)",
};

/** Como a camada aparece no painel: o nome dado, o texto, ou o tipo. */
export function layerName(element: ArtElement): string {
	const name = element.name.trim();
	if (name) {
		return name;
	}
	if (element.kind === "TEXT") {
		const text = element.content.replace(/\s+/g, " ").trim();
		return text ? text.slice(0, 40) : KIND_LABEL.TEXT;
	}
	return KIND_LABEL[element.kind];
}

// ── criar ──────────────────────────────────────────────────────────────────

function base(id: string, name: string, box: Bounds): ElementBase {
	return {
		id,
		name,
		...box,
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
	};
}

function centered(canvas: Size, width: number, height: number): Bounds {
	return {
		x: Math.round((canvas.width - width) / 2),
		y: Math.round((canvas.height - height) / 2),
		width: Math.round(width),
		height: Math.round(height),
	};
}

/**
 * Um elemento novo, já num tamanho e lugar úteis — no centro do quadro, com
 * cor que aparece sobre o fundo branco. A foto e a imagem sem proporção
 * conhecida nascem do tamanho do quadro: é o caso da moldura.
 */
export function newElement(
	kind: ElementKind,
	format: ArtFormat,
	id: string,
	extra: { mediaId?: string; imageSize?: Size | null } = {},
): ArtElement {
	const canvas = canvasOf(format);
	const full = { x: 0, y: 0, width: canvas.width, height: canvas.height };
	switch (kind) {
		case "PHOTO":
			return {
				...base(id, KIND_LABEL.PHOTO, full),
				kind,
				cornerRadius: 0,
				stroke: null,
			};
		case "IMAGE": {
			const size = extra.imageSize;
			const box =
				size && size.width > 0 && size.height > 0
					? centered(
							canvas,
							canvas.width,
							(canvas.width * size.height) / size.width,
						)
					: full;
			return {
				...base(id, KIND_LABEL.IMAGE, box),
				kind,
				mediaId: extra.mediaId ?? "",
				fit: "stretch",
				cornerRadius: 0,
			};
		}
		case "RECT":
			return {
				...base(
					id,
					KIND_LABEL.RECT,
					centered(canvas, canvas.width * 0.7, canvas.width * 0.4),
				),
				kind,
				fill: { type: "solid", color: "#d9232e" },
				cornerRadius: 32,
				stroke: null,
				shadow: null,
			};
		case "ELLIPSE":
			return {
				...base(id, KIND_LABEL.ELLIPSE, centered(canvas, 360, 360)),
				kind,
				fill: { type: "solid", color: "#ffd400" },
				stroke: null,
				shadow: null,
			};
		case "LINE":
			return {
				...base(id, KIND_LABEL.LINE, centered(canvas, canvas.width * 0.6, 24)),
				kind,
				stroke: { color: "#111827", width: 6 },
			};
		case "TEXT":
			return {
				...base(id, "Título", centered(canvas, canvas.width * 0.76, 240)),
				kind,
				mode: "DYNAMIC",
				content: "{{titulo}}",
				fieldLabel: "",
				style: { ...DEFAULT_TEXT_STYLE, color: "#111827" },
			};
	}
}

// ── a pilha ────────────────────────────────────────────────────────────────

export function addElements(
	design: ArtDesign,
	elements: readonly ArtElement[],
): ArtDesign {
	return { ...design, elements: [...design.elements, ...elements] };
}

export function updateElements(
	design: ArtDesign,
	ids: readonly string[],
	change: (element: ArtElement) => ArtElement,
): ArtDesign {
	const set = new Set(ids);
	return {
		...design,
		elements: design.elements.map((element) =>
			set.has(element.id) ? change(element) : element,
		),
	};
}

export function removeElements(
	design: ArtDesign,
	ids: readonly string[],
): ArtDesign {
	const set = new Set(ids);
	return {
		...design,
		elements: design.elements.filter((element) => !set.has(element.id)),
	};
}

/**
 * Cópias dos elementos, deslocadas, no topo da pilha e na ordem original. O
 * lugar da foto não se copia: o padrão só tem um (o domínio recusaria).
 */
export function copiesOf(
	design: ArtDesign,
	source: readonly ArtElement[],
	newId: () => string,
	offset = 24,
): { design: ArtDesign; ids: string[] } {
	const hasPhoto = design.elements.some((element) => element.kind === "PHOTO");
	const copies = source
		.filter((element) => element.kind !== "PHOTO" || !hasPhoto)
		.map(
			(element) =>
				({
					...structuredClone(element),
					id: newId(),
					x: element.x + offset,
					y: element.y + offset,
					locked: false,
				}) as ArtElement,
		);
	return {
		design: addElements(design, copies),
		ids: copies.map((copy) => copy.id),
	};
}

export function duplicateElements(
	design: ArtDesign,
	ids: readonly string[],
	newId: () => string,
): { design: ArtDesign; ids: string[] } {
	const set = new Set(ids);
	return copiesOf(
		design,
		design.elements.filter((element) => set.has(element.id)),
		newId,
	);
}

export type StackMove = "forward" | "backward" | "front" | "back";

/** Frente e trás, um degrau ou até a ponta — a seleção inteira junta. */
export function moveInStack(
	design: ArtDesign,
	ids: readonly string[],
	move: StackMove,
): ArtDesign {
	const set = new Set(ids);
	const elements = [...design.elements];
	const picked = (element: ArtElement | undefined) =>
		element !== undefined && set.has(element.id);
	if (move === "front" || move === "back") {
		const chosen = elements.filter(picked);
		const rest = elements.filter((element) => !picked(element));
		return {
			...design,
			elements: move === "front" ? [...rest, ...chosen] : [...chosen, ...rest],
		};
	}
	if (move === "forward") {
		for (let index = elements.length - 2; index >= 0; index -= 1) {
			if (picked(elements[index]) && !picked(elements[index + 1])) {
				swap(elements, index, index + 1);
			}
		}
	} else {
		for (let index = 1; index < elements.length; index += 1) {
			if (picked(elements[index]) && !picked(elements[index - 1])) {
				swap(elements, index, index - 1);
			}
		}
	}
	return { ...design, elements };
}

/** Arrastar a camada no painel: tira de onde está e põe no índice da pilha. */
export function moveToIndex(
	design: ArtDesign,
	id: string,
	index: number,
): ArtDesign {
	const from = design.elements.findIndex((element) => element.id === id);
	if (from < 0) {
		return design;
	}
	const elements = [...design.elements];
	const [moved] = elements.splice(from, 1);
	const target = Math.max(0, Math.min(elements.length, index));
	elements.splice(target, 0, moved as ArtElement);
	return { ...design, elements };
}

function swap<T>(list: T[], a: number, b: number): void {
	const first = list[a] as T;
	list[a] = list[b] as T;
	list[b] = first;
}

// ── geometria ──────────────────────────────────────────────────────────────

/** Move os não travados. */
export function moveElements(
	design: ArtDesign,
	ids: readonly string[],
	dx: number,
	dy: number,
): ArtDesign {
	return updateElements(design, ids, (element) =>
		element.locked
			? element
			: { ...element, x: element.x + dx, y: element.y + dy },
	);
}

export function unionBounds(list: readonly Bounds[]): Bounds {
	const left = Math.min(...list.map((item) => item.x));
	const top = Math.min(...list.map((item) => item.y));
	const right = Math.max(...list.map((item) => item.x + item.width));
	const bottom = Math.max(...list.map((item) => item.y + item.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

export type AlignMode =
	| "left"
	| "hcenter"
	| "right"
	| "top"
	| "vcenter"
	| "bottom";

/**
 * Alinha como no Canva e no nerp-2: um elemento, ao QUADRO; vários, à caixa
 * que envolve a seleção. Usa a caixa girada — um texto inclinado alinhado à
 * esquerda encosta a ponta, não a caixa invisível.
 */
export function alignElements(
	design: ArtDesign,
	ids: readonly string[],
	mode: AlignMode,
	canvas: Size,
): ArtDesign {
	const set = new Set(ids);
	const targets = design.elements.filter(
		(element) => set.has(element.id) && !element.locked,
	);
	if (targets.length === 0) {
		return design;
	}
	const frame =
		targets.length === 1
			? { x: 0, y: 0, width: canvas.width, height: canvas.height }
			: unionBounds(targets.map(rotatedBounds));
	return updateElements(
		design,
		targets.map((element) => element.id),
		(element) => {
			const box = rotatedBounds(element);
			let dx = 0;
			let dy = 0;
			switch (mode) {
				case "left":
					dx = frame.x - box.x;
					break;
				case "hcenter":
					dx = frame.x + frame.width / 2 - (box.x + box.width / 2);
					break;
				case "right":
					dx = frame.x + frame.width - (box.x + box.width);
					break;
				case "top":
					dy = frame.y - box.y;
					break;
				case "vcenter":
					dy = frame.y + frame.height / 2 - (box.y + box.height / 2);
					break;
				case "bottom":
					dy = frame.y + frame.height - (box.y + box.height);
					break;
			}
			return {
				...element,
				x: Math.round(element.x + dx),
				y: Math.round(element.y + dy),
			};
		},
	);
}

/**
 * Distribui com espaços iguais entre as caixas — as das pontas ficam onde
 * estão. Pede três ou mais; com menos, não há o que distribuir.
 */
export function distributeElements(
	design: ArtDesign,
	ids: readonly string[],
	axis: "horizontal" | "vertical",
): ArtDesign {
	const set = new Set(ids);
	const targets = design.elements.filter(
		(element) => set.has(element.id) && !element.locked,
	);
	if (targets.length < 3) {
		return design;
	}
	const start = (box: Bounds) => (axis === "horizontal" ? box.x : box.y);
	const size = (box: Bounds) =>
		axis === "horizontal" ? box.width : box.height;
	const sorted = targets
		.map((element) => ({ element, box: rotatedBounds(element) }))
		.sort((a, b) => start(a.box) - start(b.box));
	const first = sorted[0] as (typeof sorted)[number];
	const last = sorted.at(-1) as (typeof sorted)[number];
	const total = start(last.box) + size(last.box) - start(first.box);
	const occupied = sorted.reduce((sum, item) => sum + size(item.box), 0);
	const gap = (total - occupied) / (sorted.length - 1);

	const shifts = new Map<string, number>();
	let cursor = start(first.box);
	for (const item of sorted) {
		shifts.set(item.element.id, cursor - start(item.box));
		cursor += size(item.box) + gap;
	}
	return updateElements(
		design,
		targets.map((element) => element.id),
		(element) => {
			const shift = Math.round(shifts.get(element.id) ?? 0);
			return axis === "horizontal"
				? { ...element, x: element.x + shift }
				: { ...element, y: element.y + shift };
		},
	);
}

export type Guides = { vertical: number[]; horizontal: number[] };

/**
 * O ímã das guias: a caixa arrastada encosta nas bordas e no centro do quadro
 * e dos outros elementos, quando chega a `threshold` (em pixels do quadro) de
 * um deles. Devolve o ajuste e as linhas a desenhar.
 */
export function snapBounds(
	moving: Bounds,
	targets: readonly Bounds[],
	canvas: Size,
	threshold: number,
): { dx: number; dy: number; guides: Guides } {
	const axis = (
		edges: readonly number[],
		lines: readonly number[],
	): { delta: number; line: number | null } => {
		let best = { delta: 0, line: null as number | null, distance: threshold };
		for (const line of lines) {
			for (const edge of edges) {
				const distance = Math.abs(line - edge);
				if (distance <= best.distance) {
					best = { delta: line - edge, line, distance };
				}
			}
		}
		return { delta: best.delta, line: best.line };
	};
	const x = axis(
		[moving.x, moving.x + moving.width / 2, moving.x + moving.width],
		[
			0,
			canvas.width / 2,
			canvas.width,
			...targets.flatMap((box) => [
				box.x,
				box.x + box.width / 2,
				box.x + box.width,
			]),
		],
	);
	const y = axis(
		[moving.y, moving.y + moving.height / 2, moving.y + moving.height],
		[
			0,
			canvas.height / 2,
			canvas.height,
			...targets.flatMap((box) => [
				box.y,
				box.y + box.height / 2,
				box.y + box.height,
			]),
		],
	);
	return {
		dx: x.delta,
		dy: y.delta,
		guides: {
			vertical: x.line === null ? [] : [x.line],
			horizontal: y.line === null ? [] : [y.line],
		},
	};
}

/**
 * A caixa do elemento a partir do nó Konva depois de arrastar ou transformar.
 * O grupo fica posicionado pelo CENTRO (D7): o centro é a posição; o tamanho, o
 * de antes vezes a escala — que volta a 1, porque quem guarda o tamanho é o
 * desenho, não o nó.
 */
export function geometryFromNode(node: {
	x: number;
	y: number;
	width: number;
	height: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
}): Pick<ElementBase, "x" | "y" | "width" | "height" | "rotation"> {
	const width = Math.max(1, Math.round(node.width * Math.abs(node.scaleX)));
	const height = Math.max(1, Math.round(node.height * Math.abs(node.scaleY)));
	return {
		x: Math.round(node.x - width / 2),
		y: Math.round(node.y - height / 2),
		width,
		height,
		rotation: normalizeRotation(node.rotation),
	};
}

/** Graus entre -180 e 180, com uma casa. */
export function normalizeRotation(degrees: number): number {
	let value = degrees % 360;
	if (value > 180) {
		value -= 360;
	}
	if (value <= -180) {
		value += 360;
	}
	return Math.round(value * 10) / 10;
}

/**
 * Trocar o formato do quadro. Largura é a mesma (1080); muda a altura. Quem
 * ocupava a altura inteira (a foto, a moldura) estica junto; o resto desce ou
 * sobe pela metade da diferença, para continuar no mesmo lugar em relação ao
 * centro.
 */
export function reframeDesign(
	design: ArtDesign,
	from: ArtFormat,
	to: ArtFormat,
): ArtDesign {
	const before = canvasOf(from);
	const after = canvasOf(to);
	const difference = after.height - before.height;
	if (difference === 0) {
		return design;
	}
	return {
		...design,
		elements: design.elements.map((element) =>
			element.y <= 0 && element.y + element.height >= before.height
				? { ...element, height: element.height + difference }
				: { ...element, y: Math.round(element.y + difference / 2) },
		),
	};
}

// ── história (D10) ─────────────────────────────────────────────────────────

export type History<T> = { past: T[]; present: T; future: T[] };
export const HISTORY_LIMIT = 100;

export function historyOf<T>(present: T): History<T> {
	return { past: [], present, future: [] };
}

/** Uma mudança concluída. A mesma referência não é mudança. */
export function commit<T>(
	history: History<T>,
	next: T,
	limit = HISTORY_LIMIT,
): History<T> {
	if (next === history.present) {
		return history;
	}
	return {
		past: [...history.past, history.present].slice(-limit),
		present: next,
		future: [],
	};
}

/**
 * Troca o presente SEM abrir um passo novo — é o que junta as teclas de um
 * mesmo campo num passo só de desfazer, em vez de um passo por letra.
 */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
	return next === history.present
		? history
		: { past: history.past, present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
	if (history.past.length === 0) {
		return history;
	}
	return {
		past: history.past.slice(0, -1),
		present: history.past.at(-1) as T,
		future: [history.present, ...history.future],
	};
}

export function redo<T>(history: History<T>): History<T> {
	if (history.future.length === 0) {
		return history;
	}
	return {
		past: [...history.past, history.present],
		present: history.future[0] as T,
		future: history.future.slice(1),
	};
}

// ── variáveis (D2) ─────────────────────────────────────────────────────────

/** Uma chave válida e livre a partir do nome do campo: "Chamada do botão" → `chamada_do_botao`. */
export function keyFromLabel(label: string, taken: readonly string[]): string {
	const slug =
		label
			.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "")
			.replace(/^(\d)/, "v_$1")
			.slice(0, 28) || "variavel";
	const unavailable = new Set([...taken, ...SYSTEM_VARIABLE_KEYS]);
	if (!unavailable.has(slug)) {
		return slug;
	}
	let suffix = 2;
	while (unavailable.has(`${slug}_${suffix}`)) {
		suffix += 1;
	}
	return `${slug}_${suffix}`;
}

export function addVariable(
	design: ArtDesign,
	label = "Nova variável",
): { design: ArtDesign; key: string } {
	const key = keyFromLabel(
		label,
		design.variables.map((variable) => variable.key),
	);
	return {
		design: {
			...design,
			variables: [
				...design.variables,
				{ key, label, defaultValue: "", multiline: false },
			],
		},
		key,
	};
}

/**
 * Muda uma variável. Trocar a CHAVE troca também o marcador em todas as caixas
 * que a usam — senão renomear quebraria o padrão em silêncio.
 */
export function updateVariable(
	design: ArtDesign,
	key: string,
	patch: Partial<TemplateVariable>,
): ArtDesign {
	const nextKey = patch.key ?? key;
	const token = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g");
	return {
		...design,
		variables: design.variables.map((variable) =>
			variable.key === key ? { ...variable, ...patch } : variable,
		),
		elements:
			nextKey === key
				? design.elements
				: design.elements.map((element) =>
						element.kind === "TEXT" && element.mode !== "STATIC"
							? {
									...element,
									content: element.content.replace(token, `{{${nextKey}}}`),
								}
							: element,
					),
	};
}

export function removeVariable(design: ArtDesign, key: string): ArtDesign {
	return {
		...design,
		variables: design.variables.filter((variable) => variable.key !== key),
	};
}

/** Quantas caixas usam a variável — o aviso antes de apagá-la. */
export function variableUsage(design: ArtDesign, key: string): number {
	const token = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`);
	return design.elements.filter(
		(element) =>
			element.kind === "TEXT" &&
			element.mode !== "STATIC" &&
			token.test(element.content),
	).length;
}

/** Insere `{{chave}}` no cursor, trocando o que estiver selecionado. */
export function insertToken(
	text: string,
	selectionStart: number,
	selectionEnd: number,
	key: string,
): { text: string; caret: number } {
	const token = `{{${key}}}`;
	const start = Math.max(0, Math.min(selectionStart, text.length));
	const end = Math.max(start, Math.min(selectionEnd, text.length));
	return {
		text: `${text.slice(0, start)}${token}${text.slice(end)}`,
		caret: start + token.length,
	};
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── fontes ─────────────────────────────────────────────────────────────────

/** O peso mais próximo que a família tem. */
export function nearestWeight(
	family: TemplateFontFamily,
	weight: number,
): number {
	const spec: TemplateFontSpec = TEMPLATE_FONTS[family];
	return spec.weights.reduce((best, candidate) =>
		Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best,
	);
}

/** Trocar a família mantém o que der: o peso mais próximo; o itálico, se houver. */
export function withFontFamily(
	style: TextStyle,
	family: TemplateFontFamily,
): TextStyle {
	return {
		...style,
		fontFamily: family,
		fontWeight: nearestWeight(family, style.fontWeight),
		italic: style.italic && TEMPLATE_FONTS[family].italic,
	};
}
