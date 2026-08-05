/**
 * Erros de regra de negócio do contexto de mídia. São VALORES devolvidos em
 * `Result` — não exceções. Os invariantes A29 (crédito sempre; imagem com
 * alt-text e dimensões) são do DOMÍNIO, não da tela.
 */

/** Crédito/fotógrafo ausente — exigência jurídica: todo asset tem crédito. */
export class MissingCredit extends Error {
	constructor() {
		super("Todo arquivo de mídia precisa de crédito (fotógrafo/fonte).");
		this.name = "MissingCredit";
	}
}

/** Imagem sem texto alternativo — acessibilidade é invariante (A29). */
export class MissingAltText extends Error {
	constructor() {
		super("Imagens exigem texto alternativo (alt-text) para acessibilidade.");
		this.name = "MissingAltText";
	}
}

/** Imagem sem dimensões — necessárias para o corte responsivo sem CLS. */
export class MissingDimensions extends Error {
	constructor() {
		super("Imagens exigem largura e altura.");
		this.name = "MissingDimensions";
	}
}

/** Largura/altura não positivas ou não inteiras. */
export class InvalidDimensions extends Error {
	constructor() {
		super("Dimensões inválidas: largura e altura devem ser inteiros positivos.");
		this.name = "InvalidDimensions";
	}
}

/** Ponto focal fora do quadrado unitário [0,1]×[0,1]. */
export class InvalidFocalPoint extends Error {
	constructor() {
		super("Ponto focal inválido: x e y devem estar entre 0 e 1.");
		this.name = "InvalidFocalPoint";
	}
}
