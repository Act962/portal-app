/**
 * Erros de regra de negócio do contexto de identidade. São VALORES devolvidos
 * em `Result` pelos casos de uso — não exceções. Quem chama trata (o compilador
 * cobra).
 */
export class Forbidden extends Error {
	constructor(message = "Ação não permitida para este usuário.") {
		super(message);
		this.name = "Forbidden";
	}
}

export class StaffNotFound extends Error {
	constructor(staffId: string) {
		super(`Membro da redação não encontrado: ${staffId}`);
		this.name = "StaffNotFound";
	}
}
