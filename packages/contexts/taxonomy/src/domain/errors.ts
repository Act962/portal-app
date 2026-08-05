/**
 * Erros de regra de negócio do contexto de taxonomia. São VALORES devolvidos em
 * `Result` pelo domínio e pelos casos de uso — não exceções. Quem chama trata
 * (o compilador cobra). Ver docs/specs/00-fundacao.md §6.
 */

/** Nome (de editoria ou tag) vazio depois de aparado. */
export class NameRequired extends Error {
	constructor(entity: string) {
		super(`O nome ${entity} é obrigatório.`);
		this.name = "NameRequired";
	}
}

/** Texto não pôde ser reduzido a um slug válido (kebab-case, sem acento). */
export class InvalidSlug extends Error {
	constructor(raw: string) {
		super(`Não foi possível gerar um slug válido a partir de "${raw}".`);
		this.name = "InvalidSlug";
	}
}

/** Cor fora do formato hexadecimal (`#rgb` ou `#rrggbb`). */
export class InvalidColor extends Error {
	constructor(raw: string) {
		super(`Cor inválida: "${raw}". Use hexadecimal como #a1b2c3.`);
		this.name = "InvalidColor";
	}
}

/**
 * A hierarquia de editorias tem no máximo dois níveis: uma editoria que já é
 * filha não pode ser mãe de outra.
 */
export class MaxDepthExceeded extends Error {
	constructor() {
		super("Editorias têm no máximo dois níveis; uma subeditoria não pode ter filhas.");
		this.name = "MaxDepthExceeded";
	}
}

/**
 * Tentativa de excluir uma editoria que ainda classifica conteúdo publicado.
 * O caminho permitido é desativar (A17), preservando a URL e o histórico.
 */
export class SectionInUse extends Error {
	constructor() {
		super("Editoria em uso por matérias não pode ser excluída; desative-a.");
		this.name = "SectionInUse";
	}
}
