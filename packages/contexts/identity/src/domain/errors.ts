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

/** E-mail de convite fora de formato. */
export class InvalidInviteEmail extends Error {
	constructor(raw: string) {
		super(`"${raw}" não é um e-mail válido.`);
		this.name = "InvalidInviteEmail";
	}
}

/** Convite já usado — o cadastro correspondente já aconteceu. */
export class InvitationAlreadyAccepted extends Error {
	constructor(email: string) {
		super(`O convite para ${email} já foi usado.`);
		this.name = "InvitationAlreadyAccepted";
	}
}

/** Convite vencido. O caminho é convidar de novo, não estender. */
export class InvitationExpired extends Error {
	constructor(email: string) {
		super(`O convite para ${email} venceu. Envie um novo convite.`);
		this.name = "InvitationExpired";
	}
}

/**
 * Tentativa de cadastro sem convite aberto. É a mensagem que a pessoa vê ao
 * tentar criar conta num painel fechado — deliberadamente sem dizer se o e-mail
 * existe ou não no sistema.
 */
export class NotInvited extends Error {
	constructor() {
		super(
			"Cadastro disponível apenas por convite. Peça a um administrador do portal.",
		);
		this.name = "NotInvited";
	}
}

/** Já existe convite aberto para este e-mail. */
export class InvitationAlreadyExists extends Error {
	constructor(email: string) {
		super(`Já existe um convite aberto para ${email}.`);
		this.name = "InvitationAlreadyExists";
	}
}
