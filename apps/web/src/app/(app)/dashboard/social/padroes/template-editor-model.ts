import {
	type ArtContent,
	type ArtFormat,
	type Box,
	canvasOf,
	DEFAULT_TEXT_STYLE,
	type Size,
	TEMPLATE_FONTS,
	type TemplateFontFamily,
	type TemplateFontSpec,
	type TemplateLayer,
	type TextSource,
	type TextStyle,
} from "@portal-app/social";

/**
 * A lógica do editor de padrões, SEM JSX e SEM React (regra de testes do
 * projeto — o modelo é o `serialize.ts` do editor de matéria).
 *
 * Tudo aqui é aritmética e manipulação de lista: criar camada, empilhar, mover e
 * redimensionar caixa, converter a escala da tela para o quadro. É o que erra
 * em silêncio num editor visual — a caixa que "pula" ao redimensionar pela
 * esquerda, a foto que vai parar por cima do título — e se prova com tabela de
 * casos, sem montar componente.
 *
 * Todas as medidas das caixas estão em PIXELS DO QUADRO (1080 de largura). A
 * tela mostra o quadro reduzido; a conversão é `toCanvas`, num lugar só.
 */

export type LayerKind = TemplateLayer["kind"];

export const LAYER_KIND_LABEL: Record<LayerKind, string> = {
	PHOTO: "Foto da matéria",
	IMAGE: "Imagem",
	SHAPE: "Forma",
	TEXT: "Texto",
};

export const TEXT_SOURCE_LABEL: Record<TextSource, string> = {
	HEADLINE: "Título da matéria",
	KICKER: "Chapéu",
	SECTION: "Editoria",
	STATIC: "Texto fixo",
};

/** Como a camada aparece na lista — o texto fixo mostra o começo do texto. */
export function layerLabel(layer: TemplateLayer): string {
	if (layer.kind !== "TEXT") {
		return LAYER_KIND_LABEL[layer.kind];
	}
	const base = TEXT_SOURCE_LABEL[layer.source];
	if (layer.source !== "STATIC" || layer.text.trim() === "") {
		return base;
	}
	const text = layer.text.trim();
	return `${base}: ${text.length > 24 ? `${text.slice(0, 23)}…` : text}`;
}

/**
 * Uma camada nova, num tamanho que faz sentido no quadro deste formato.
 *
 * Foto e imagem nascem cobrindo o quadro inteiro — é o caso comum (foto de
 * fundo, moldura em PNG do tamanho da arte). Forma e texto nascem no meio,
 * pequenos o bastante para se ver que são caixas e se arrastar.
 */
export function newLayer(
	kind: LayerKind,
	format: ArtFormat,
	id: string,
	options: { mediaId?: string } = {},
): TemplateLayer {
	const canvas = canvasOf(format);
	const full: Box = { x: 0, y: 0, width: canvas.width, height: canvas.height };
	switch (kind) {
		case "PHOTO":
			return { id, kind, box: full };
		case "IMAGE":
			return {
				id,
				kind,
				box: full,
				mediaId: options.mediaId ?? "",
				fit: "cover",
			};
		case "SHAPE":
			return {
				id,
				kind,
				box: centered(canvas, 0.7, 0.3),
				color: "#d9232e",
				radius: 32,
				opacity: 1,
			};
		case "TEXT":
			return {
				id,
				kind,
				// Mais estreita que a forma nova (70%) de propósito: o título
				// adicionado sobre um cartão cai DENTRO dele. Mais larga, as pontas
				// das linhas sobravam para fora do cartão — e, em branco sobre o
				// fundo branco do quadro sem foto, pareciam cortadas.
				box: centered(canvas, 0.62, 0.18),
				source: "HEADLINE",
				text: "",
				style: { ...DEFAULT_TEXT_STYLE },
			};
	}
}

function centered(canvas: Size, widthRatio: number, heightRatio: number): Box {
	const width = Math.round(canvas.width * widthRatio);
	const height = Math.round(canvas.height * heightRatio);
	return {
		x: Math.round((canvas.width - width) / 2),
		y: Math.round((canvas.height - height) / 2),
		width,
		height,
	};
}

/**
 * Põe a camada na pilha. A FOTO vai para o fundo; o resto, para o topo.
 *
 * A foto vai para baixo porque é quase sempre o fundo — adicioná-la por último
 * e vê-la cobrir moldura e título inteiros faria parecer que o editor apagou o
 * padrão.
 */
export function addLayer(
	layers: readonly TemplateLayer[],
	layer: TemplateLayer,
): TemplateLayer[] {
	return layer.kind === "PHOTO" ? [layer, ...layers] : [...layers, layer];
}

export function updateLayer(
	layers: readonly TemplateLayer[],
	id: string,
	change: (layer: TemplateLayer) => TemplateLayer,
): TemplateLayer[] {
	return layers.map((layer) => (layer.id === id ? change(layer) : layer));
}

export function removeLayer(
	layers: readonly TemplateLayer[],
	id: string,
): TemplateLayer[] {
	return layers.filter((layer) => layer.id !== id);
}

/**
 * Sobe (`up`, para frente — mais tarde na lista) ou desce a camada uma posição
 * na pilha. Nas pontas, não faz nada.
 */
export function moveLayer(
	layers: readonly TemplateLayer[],
	id: string,
	direction: "up" | "down",
): TemplateLayer[] {
	const index = layers.findIndex((layer) => layer.id === id);
	const target = direction === "up" ? index + 1 : index - 1;
	if (index < 0 || target < 0 || target >= layers.length) {
		return [...layers];
	}
	const next = [...layers];
	const [moved] = next.splice(index, 1);
	if (moved) {
		next.splice(target, 0, moved);
	}
	return next;
}

/** Duplica a camada logo acima da original, deslocada para se ver a cópia. */
export function duplicateLayer(
	layers: readonly TemplateLayer[],
	id: string,
	newId: string,
): TemplateLayer[] {
	const index = layers.findIndex((layer) => layer.id === id);
	const source = layers[index];
	if (!source || source.kind === "PHOTO") {
		// Foto não se duplica: o padrão aceita uma só.
		return [...layers];
	}
	const copy = {
		...source,
		id: newId,
		box: moveBox(source.box, 24, 24),
	} as TemplateLayer;
	const next = [...layers];
	next.splice(index + 1, 0, copy);
	return next;
}

// ── caixa ───────────────────────────────────────────────────────────────────

/** O menor lado que uma caixa pode ter ao redimensionar, em pixels do quadro. */
export const MIN_BOX = 16;

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: readonly Handle[] = [
	"nw",
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
];

export function moveBox(box: Box, dx: number, dy: number): Box {
	return {
		...box,
		x: Math.round(box.x + dx),
		y: Math.round(box.y + dy),
	};
}

/**
 * Redimensiona pela alça. Pelas alças do oeste e do norte, a ORIGEM anda e a
 * borda oposta fica parada — é o que evita a caixa "pular" quando se puxa pela
 * esquerda. No mínimo de tamanho, a borda que se move para, e não a outra.
 */
export function resizeBox(
	box: Box,
	handle: Handle,
	dx: number,
	dy: number,
	min: number = MIN_BOX,
): Box {
	let { x, y, width, height } = box;
	const right = box.x + box.width;
	const bottom = box.y + box.height;

	if (handle.includes("e")) {
		width = Math.max(min, box.width + dx);
	}
	if (handle.includes("w")) {
		width = Math.max(min, box.width - dx);
		x = right - width;
	}
	if (handle.includes("s")) {
		height = Math.max(min, box.height + dy);
	}
	if (handle.includes("n")) {
		height = Math.max(min, box.height - dy);
		y = bottom - height;
	}

	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(width),
		height: Math.round(height),
	};
}

/**
 * Encosta a caixa nas guias do quadro — bordas e centro — quando passa perto.
 *
 * Só no ARRASTAR, e só a posição: sem isto, centralizar o título à mão é uma
 * caça ao pixel; com isto em cada redimensionar, a caixa brigaria com a mão.
 */
export function snapBox(box: Box, canvas: Size, threshold: number): Box {
	const snapAxis = (start: number, size: number, total: number) => {
		const candidates = [
			{ at: 0, offset: 0 },
			{ at: total, offset: size },
			{ at: total / 2, offset: size / 2 },
		];
		for (const { at, offset } of candidates) {
			if (Math.abs(start + offset - at) <= threshold) {
				return Math.round(at - offset);
			}
		}
		return start;
	};
	return {
		...box,
		x: snapAxis(box.x, box.width, canvas.width),
		y: snapAxis(box.y, box.height, canvas.height),
	};
}

// ── escala ──────────────────────────────────────────────────────────────────

/**
 * Quanto o quadro precisa encolher para caber na área da tela. Nunca amplia:
 * mostrar a arte maior que o tamanho real só borraria a prévia.
 */
export function fitScale(canvas: Size, available: Size): number {
	if (available.width <= 0 || available.height <= 0) {
		return 1;
	}
	return Math.min(
		1,
		available.width / canvas.width,
		available.height / canvas.height,
	);
}

/** Pixels da TELA para pixels do QUADRO. */
export function toCanvas(screenPixels: number, scale: number): number {
	return scale > 0 ? screenPixels / scale : screenPixels;
}

/**
 * A caixa cobre (quase) o quadro inteiro, contando só a parte visível?
 *
 * É a moldura em PNG do tamanho da arte: desenhada por cima de tudo, ela
 * roubaria o clique de todas as camadas de baixo. O editor a deixa "vazada" ao
 * clique enquanto não está selecionada — ela continua escolhível pela lista.
 */
export function coversMostOfCanvas(
	box: Box,
	canvas: Size,
	ratio = 0.9,
): boolean {
	const visibleWidth = Math.max(
		0,
		Math.min(box.x + box.width, canvas.width) - Math.max(box.x, 0),
	);
	const visibleHeight = Math.max(
		0,
		Math.min(box.y + box.height, canvas.height) - Math.max(box.y, 0),
	);
	return visibleWidth * visibleHeight >= canvas.width * canvas.height * ratio;
}

/** O peso disponível mais perto do pedido (no empate, o mais leve). */
export function nearestWeight(
	weights: readonly number[],
	weight: number,
): number {
	return weights.reduce(
		(best, candidate) =>
			Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best,
		weights[0] ?? weight,
	);
}

/**
 * Troca a família mantendo o que der: o peso vai para o mais próximo que a
 * família tem, e o itálico cai se ela não tiver. Sem isto, trocar Montserrat
 * Black itálico por Oswald deixaria um estilo que o servidor recusa.
 */
export function withFontFamily(
	style: TextStyle,
	family: TemplateFontFamily,
): TextStyle {
	const spec: TemplateFontSpec = TEMPLATE_FONTS[family];
	return {
		...style,
		fontFamily: family,
		fontWeight: spec.weights.includes(style.fontWeight)
			? style.fontWeight
			: nearestWeight(spec.weights, style.fontWeight),
		italic: style.italic && spec.italic,
	};
}

/**
 * Leva as caixas de um formato para outro, na mesma PROPORÇÃO do quadro — o
 * título que estava a meia altura no 4:5 continua a meia altura no 9:16. Sem
 * isto, trocar o formato deixaria metade das camadas fora do quadro novo.
 */
export function rescaleLayers(
	layers: readonly TemplateLayer[],
	from: ArtFormat,
	to: ArtFormat,
): TemplateLayer[] {
	if (from === to) {
		return [...layers];
	}
	const source = canvasOf(from);
	const target = canvasOf(to);
	const sx = target.width / source.width;
	const sy = target.height / source.height;
	return layers.map(
		(layer) =>
			({
				...layer,
				box: {
					x: Math.round(layer.box.x * sx),
					y: Math.round(layer.box.y * sy),
					width: Math.max(1, Math.round(layer.box.width * sx)),
					height: Math.max(1, Math.round(layer.box.height * sy)),
				},
			}) as TemplateLayer,
	);
}

// ── dados de exemplo ────────────────────────────────────────────────────────

/**
 * O texto de exemplo com que o editor desenha a prévia. Longo de propósito: o
 * padrão precisa ser testado contra a manchete de vinte palavras, que é onde ele
 * quebra — a de três palavras cabe em qualquer caixa.
 */
export const SAMPLE_CONTENT: ArtContent = {
	headline:
		"Estudantes da rede municipal de Piracuruca são premiados na OBMEP e destacam avanço da educação no município",
	kicker: "Últimas",
	sectionName: "Educação",
};

export const SHORT_SAMPLE_HEADLINE = "Chuva alaga o centro";
