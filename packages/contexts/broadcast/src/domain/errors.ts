/**
 * Erros de regra de negócio do contexto de programação. São VALORES devolvidos
 * em `Result` pelo domínio e pelos casos de uso — não exceções.
 */

/** Nome do programa vazio depois de aparado. */
export class NameRequired extends Error {
	constructor() {
		super("O nome do programa é obrigatório.");
		this.name = "NameRequired";
	}
}

/** Locutor vazio depois de aparado. */
export class HostRequired extends Error {
	constructor() {
		super("O nome do locutor é obrigatório.");
		this.name = "HostRequired";
	}
}

/** Horário fora do formato `HH:MM` (24h). */
export class InvalidTime extends Error {
	constructor(raw: string) {
		super(`Horário inválido: "${raw}". Use o formato HH:MM (24h).`);
		this.name = "InvalidTime";
	}
}

/** Dia da semana fora de 0 (domingo) a 6 (sábado). */
export class InvalidDayOfWeek extends Error {
	constructor(raw: number) {
		super(`Dia da semana inválido: ${raw}. Use um número de 0 (domingo) a 6 (sábado).`);
		this.name = "InvalidDayOfWeek";
	}
}

/**
 * O horário de término precisa vir depois do de início — grade que atravessa a
 * meia-noite fica fora do escopo (D-programação): a rádio cadastra o programa
 * da madrugada com dia e horário de início próprios, não como "23h59→01h".
 */
export class EndBeforeStart extends Error {
	constructor() {
		super("O horário de término precisa ser depois do de início.");
		this.name = "EndBeforeStart";
	}
}

export class ProgramNotFound extends Error {
	constructor(id: string) {
		super(`Programa não encontrado: ${id}`);
		this.name = "ProgramNotFound";
	}
}
