import {
	type ArtDesign,
	type TemplateFontFamily,
	textElementsOf,
} from "@portal-app/social";

/** Um corte de fonte: família, peso e itálico. */
export type FontCut = {
	family: TemplateFontFamily;
	weight: number;
	italic: boolean;
};

/**
 * Os cortes que o desenho usa, sem repetir. É o que o navegador precisa
 * CARREGAR antes de medir o texto (spec 10, D4): o Konva mede com a fonte que
 * o navegador tem na hora, e medir com a de reserva daria outra quebra de linha.
 */
export function fontCutsOf(design: ArtDesign): FontCut[] {
	const cuts = new Map<string, FontCut>();
	for (const element of textElementsOf(design)) {
		const { fontFamily, fontWeight, italic } = element.style;
		cuts.set(`${fontFamily}:${fontWeight}:${italic}`, {
			family: fontFamily,
			weight: fontWeight,
			italic,
		});
	}
	return [...cuts.values()];
}

/** O corte no formato do `document.fonts.load`: `italic 800 64px "Nunito Sans"`. */
export function cssFontOf(cut: FontCut, size = 64): string {
	return `${cut.italic ? "italic " : ""}${cut.weight} ${size}px "${cut.family}"`;
}
