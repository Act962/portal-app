/**
 * Erros de regra do contexto de configurações. São VALORES devolvidos em
 * `Result`, não exceções — mesmo contrato dos demais contextos
 * (ver docs/specs/00-fundacao.md §6).
 */

/** Campo obrigatório vazio depois de aparado. */
export class RequiredField extends Error {
	constructor(readonly field: string) {
		super(`O campo "${field}" é obrigatório.`);
		this.name = "RequiredField";
	}
}

/** Endereço que deveria ser uma URL absoluta `http(s)` e não é. */
export class InvalidUrl extends Error {
	constructor(
		readonly field: string,
		raw: string,
	) {
		super(
			`"${raw}" não é um endereço válido em "${field}". Use http:// ou https://.`,
		);
		this.name = "InvalidUrl";
	}
}

/** E-mail fora de formato. */
export class InvalidEmail extends Error {
	constructor(raw: string) {
		super(`"${raw}" não é um e-mail válido.`);
		this.name = "InvalidEmail";
	}
}

/**
 * Destino de link recusado. Aceita-se URL absoluta `http(s)` ou caminho interno
 * começando com `/`; qualquer outra coisa — `javascript:`, `data:`, texto solto —
 * é recusada, porque link que não navega é defeito (D9).
 */
export class InvalidLinkHref extends Error {
	constructor(raw: string) {
		super(
			`"${raw}" não é um destino de link válido. Use https://… ou um caminho interno como /quem-somos.`,
		);
		this.name = "InvalidLinkHref";
	}
}

export type SettingsError =
	| RequiredField
	| InvalidUrl
	| InvalidEmail
	| InvalidLinkHref;
