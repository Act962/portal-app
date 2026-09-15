/**
 * As famílias que um padrão de arte pode usar (spec 09, D6).
 *
 * Lista FECHADA, declarada no domínio, porque o desenhista (o Satori, no
 * servidor) não lê fonte do sistema: cada família precisa ir como arquivo, e o
 * editor só pode oferecer o que o renderizador sabe desenhar. Fonte nova é uma
 * linha aqui e os arquivos no renderizador — nunca um campo livre na tela.
 *
 * `averageCharWidth` é a largura média de um caractere em frações do tamanho da
 * fonte, medida em texto corrido de português. Serve só para ESCOLHER o tamanho
 * que cabe (`fitText`); a quebra de linha real é do Satori, que conhece a fonte.
 */
export type TemplateFontSpec = {
	weights: readonly number[];
	italic: boolean;
	averageCharWidth: number;
};

export const TEMPLATE_FONTS = {
	Montserrat: {
		weights: [400, 500, 600, 700, 800, 900],
		italic: true,
		averageCharWidth: 0.6,
	},
	Poppins: {
		weights: [400, 500, 600, 700, 800, 900],
		italic: true,
		averageCharWidth: 0.6,
	},
	"Nunito Sans": {
		weights: [400, 500, 600, 700, 800, 900],
		italic: true,
		averageCharWidth: 0.54,
	},
	Oswald: {
		weights: [400, 500, 600, 700],
		italic: false,
		averageCharWidth: 0.42,
	},
	Lora: {
		weights: [400, 500, 600, 700],
		italic: true,
		averageCharWidth: 0.52,
	},
} as const satisfies Record<string, TemplateFontSpec>;

export type TemplateFontFamily = keyof typeof TEMPLATE_FONTS;

export const TEMPLATE_FONT_FAMILIES = Object.keys(
	TEMPLATE_FONTS,
) as readonly TemplateFontFamily[];

export function isTemplateFontFamily(
	value: string,
): value is TemplateFontFamily {
	return Object.hasOwn(TEMPLATE_FONTS, value);
}

/** A família tem este peso? E o itálico? — o que o editor pode oferecer. */
export function fontSupports(
	family: TemplateFontFamily,
	weight: number,
	italic: boolean,
): boolean {
	const spec: TemplateFontSpec = TEMPLATE_FONTS[family];
	return spec.weights.includes(weight) && (!italic || spec.italic);
}
