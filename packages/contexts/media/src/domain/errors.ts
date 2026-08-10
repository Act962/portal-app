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

/** Nome de pasta vazio. A pasta é identificada pelo nome para quem a usa. */
export class MissingFolderName extends Error {
	constructor() {
		super("A pasta precisa de um nome.");
		this.name = "MissingFolderName";
	}
}

/** Já existe pasta com este nome. Duas "Eleições 2026" não ajudam ninguém. */
export class FolderNameTaken extends Error {
	constructor(name: string) {
		super(`Já existe uma pasta chamada "${name}".`);
		this.name = "FolderNameTaken";
	}
}

export class FolderNotFound extends Error {
	constructor(id: string) {
		super(`Pasta não encontrada: ${id}`);
		this.name = "FolderNotFound";
	}
}

/**
 * Tentou excluir pasta com arquivo dentro (D3). A CONTAGEM vai na mensagem de
 * propósito: "tem 12 arquivos" é acionável; "não está vazia" manda o usuário
 * adivinhar o que fazer em seguida.
 */
export class FolderNotEmpty extends Error {
	constructor(readonly count: number) {
		super(
			count === 1
				? "A pasta tem 1 arquivo dentro. Mova-o antes de excluí-la."
				: `A pasta tem ${count} arquivos dentro. Mova-os antes de excluí-la.`,
		);
		this.name = "FolderNotEmpty";
	}
}

export class MediaAssetNotFound extends Error {
	constructor(id: string) {
		super(`Arquivo não encontrado: ${id}`);
		this.name = "MediaAssetNotFound";
	}
}

/**
 * Tentou excluir mídia que alguma matéria usa como capa ou bloco do corpo (D4).
 *
 * Sem esta guarda, apagar não dá erro em lugar nenhum: o portal passa a servir
 * imagem quebrada e ninguém descobre até um leitor reclamar.
 */
export class MediaInUse extends Error {
	constructor() {
		super(
			"Este arquivo está em uso por uma matéria. Troque a imagem na matéria antes de excluir.",
		);
		this.name = "MediaInUse";
	}
}

/** Tipo de arquivo que a biblioteca não aceita. */
export class UnsupportedMediaType extends Error {
	constructor(mimeType: string) {
		super(`Tipo de arquivo não aceito: ${mimeType || "desconhecido"}.`);
		this.name = "UnsupportedMediaType";
	}
}
