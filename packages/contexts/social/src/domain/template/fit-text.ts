import type { ArtTemplate, TextLayer } from "./art-template";
import { TEMPLATE_FONTS } from "./fonts";

/** O que a matéria (ou o post avulso) oferece para preencher as caixas. */
export type ArtContent = {
	headline: string;
	kicker: string | null;
	sectionName: string | null;
};

/**
 * O texto trocado NESTE post, por id da camada. Presente — mesmo vazio — vence
 * o dado da matéria: apagar o chapéu de um post é uma escolha legítima.
 */
export type TextOverrides = Readonly<Record<string, string>>;

/**
 * O texto que vai na caixa: o que a redação digitou para este post, senão o
 * dado da matéria, senão o texto fixo do padrão.
 *
 * Espaços repetidos viram um, mas a quebra de linha digitada fica — "ESTUDANTES
 * DE PIRACURUCA↵SÃO PREMIADOS" é decisão de diagramação.
 */
export function textForLayer(
	layer: TextLayer,
	content: ArtContent,
	overrides: TextOverrides = {},
): string {
	const raw = overrides[layer.id] ?? sourceText(layer, content);
	const clean = raw
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.join("\n")
		.trim();
	// pt-BR explícito: é o que garante "AÇÃO" e não depende do idioma do servidor.
	return layer.style.uppercase ? clean.toLocaleUpperCase("pt-BR") : clean;
}

function sourceText(layer: TextLayer, content: ArtContent): string {
	switch (layer.source) {
		case "HEADLINE":
			return content.headline;
		case "KICKER":
			return content.kicker ?? "";
		case "SECTION":
			return content.sectionName ?? "";
		case "STATIC":
			return layer.text;
	}
}

export type FittedText = {
	/** O tamanho escolhido. */
	fontSize: number;
	/** Quantas linhas a estimativa dá nesse tamanho. */
	lines: number;
	/** Coube sem cortar? `false` é texto que vai sair com reticências. */
	fits: boolean;
};

/** Caixa-alta é mais larga que caixa-baixa; negrito, um pouco mais. */
const UPPERCASE_WIDTH = 1.12;
const BOLD_WIDTH = 1.06;
const STEP = 2;

/**
 * O maior tamanho de fonte, entre o tamanho cheio e o mínimo, em que o texto
 * cabe na caixa (spec 09, D7).
 *
 * Estima a largura pela média de caractere da família — não conhece a fonte de
 * verdade, e não precisa: a decisão aqui é só "que tamanho", e a quebra final
 * é do Satori. A estimativa erra para o lado de caber menos (caixa-alta e
 * negrito alargam a média), porque o erro caro é o contrário: um título que a
 * tela disse que cabia saindo cortado no Instagram.
 *
 * O respiro do fundo (a pílula) sai da largura e da altura úteis.
 */
export function fitText(text: string, layer: TextLayer): FittedText {
	const { style, box } = layer;
	const paddingX = style.background?.paddingX ?? 0;
	const paddingY = style.background?.paddingY ?? 0;
	const width = Math.max(1, box.width - 2 * paddingX);
	const height = Math.max(1, box.height - 2 * paddingY);

	if (text.trim() === "") {
		return { fontSize: style.fontSize, lines: 0, fits: true };
	}

	const factor =
		TEMPLATE_FONTS[style.fontFamily].averageCharWidth *
		(style.uppercase ? UPPERCASE_WIDTH : 1) *
		(style.fontWeight >= 700 ? BOLD_WIDTH : 1);

	const measure = (size: number) => {
		const lines = estimateLines(text, width, size * factor);
		const fits =
			lines <= style.maxLines && lines * size * style.lineHeight <= height;
		return { fontSize: size, lines, fits };
	};

	for (let size = style.fontSize; size > style.minFontSize; size -= STEP) {
		const attempt = measure(size);
		if (attempt.fits) {
			return attempt;
		}
	}
	// O mínimo é tentado sempre, mesmo quando o passo pula por cima dele.
	return measure(style.minFontSize);
}

/**
 * Quantas linhas o texto ocupa numa largura, com quebra por palavra.
 *
 * Palavra maior que a linha é partida (é o que o Satori faz com uma URL ou um
 * nome sem espaço), e cada quebra de linha digitada abre linha nova.
 */
export function estimateLines(
	text: string,
	width: number,
	charWidth: number,
): number {
	const perLine = Math.max(1, Math.floor(width / Math.max(charWidth, 0.01)));
	let total = 0;
	for (const paragraph of text.split("\n")) {
		const words = paragraph.split(" ").filter((word) => word !== "");
		if (words.length === 0) {
			total += 1;
			continue;
		}
		let lines = 1;
		let used = 0;
		for (const word of words) {
			const length = [...word].length;
			if (length > perLine) {
				if (used > 0) {
					lines += 1;
				}
				lines += Math.ceil(length / perLine) - 1;
				used = length % perLine || perLine;
				continue;
			}
			const needed = used === 0 ? length : used + 1 + length;
			if (needed > perLine) {
				lines += 1;
				used = length;
			} else {
				used = needed;
			}
		}
		total += lines;
	}
	return total;
}

const SOURCE_LABEL: Record<TextLayer["source"], string> = {
	HEADLINE: "O título",
	KICKER: "O chapéu",
	SECTION: "A editoria",
	STATIC: "O texto fixo",
};

/**
 * Os textos que não cabem nem no tamanho mínimo, em frases para a tela — o
 * aviso ANTES da aprovação que o D7 promete.
 */
export function overflowWarnings(
	template: ArtTemplate,
	content: ArtContent,
	overrides: TextOverrides = {},
): string[] {
	return template.textLayers
		.filter(
			(layer) => !fitText(textForLayer(layer, content, overrides), layer).fits,
		)
		.map(
			(layer) =>
				`${SOURCE_LABEL[layer.source]} não cabe no padrão "${template.name}" nem no tamanho mínimo e vai sair cortado.`,
		);
}
