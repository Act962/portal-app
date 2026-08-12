/**
 * Erros de regra de negócio do contexto de colunistas. São VALORES devolvidos
 * em `Result` pelo domínio e pelos casos de uso — não exceções.
 */

/** Nome vazio depois de aparado. */
export class NameRequired extends Error {
	constructor() {
		super("O nome do colunista é obrigatório.");
		this.name = "NameRequired";
	}
}

/**
 * O nome não sobrevive à normalização do slug — acontece quando ele só tem
 * pontuação ou caracteres que somem ao tirar acento ("...", "@@@").
 */
export class InvalidSlug extends Error {
	constructor(raw: string) {
		super(`Não foi possível gerar um endereço válido a partir de "${raw}".`);
		this.name = "InvalidSlug";
	}
}

/**
 * Dois colunistas com a mesma assinatura seriam a mesma página de autor, e o
 * bloco da home mostraria a pessoa duas vezes.
 */
export class SlugTaken extends Error {
	constructor(slug: string) {
		super(`Já existe um colunista com o endereço "${slug}".`);
		this.name = "SlugTaken";
	}
}

export class ColumnistNotFound extends Error {
	constructor(id: string) {
		super(`Colunista não encontrado: ${id}`);
		this.name = "ColumnistNotFound";
	}
}

/**
 * O e-mail de contato é PUBLICADO no perfil — sai no portal, num `mailto:`.
 * Por isso ele é recusado na entrada em vez de guardado torto: um endereço
 * inválido aqui não gera erro em lugar nenhum, só um link que o leitor clica e
 * não chega a ninguém.
 */
export class InvalidColumnistEmail extends Error {
	constructor(raw: string) {
		super(`E-mail de contato inválido: "${raw}".`);
		this.name = "InvalidColumnistEmail";
	}
}
