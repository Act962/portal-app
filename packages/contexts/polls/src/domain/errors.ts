/**
 * Erros de regra de negócio do contexto de enquetes. São VALORES devolvidos em
 * `Result` pelo domínio e pelos casos de uso — não exceções.
 */

export class QuestionRequired extends Error {
	constructor() {
		super("A pergunta da enquete é obrigatória.");
		this.name = "QuestionRequired";
	}
}

/** Enquete com menos de duas opções não é enquete — é afirmação. */
export class TooFewOptions extends Error {
	constructor() {
		super("A enquete precisa de pelo menos duas opções.");
		this.name = "TooFewOptions";
	}
}

export class OptionLabelRequired extends Error {
	constructor() {
		super("Toda opção precisa de um texto.");
		this.name = "OptionLabelRequired";
	}
}

/**
 * Tentativa de mudar as opções de uma enquete que já saiu do rascunho. Depois
 * de publicada há votos apontando para as opções: trocá-las faria o voto de
 * alguém significar outra coisa.
 */
export class OptionsLockedAfterPublish extends Error {
	constructor() {
		super(
			"As opções não mudam depois de publicada — os votos já registrados perderiam o sentido.",
		);
		this.name = "OptionsLockedAfterPublish";
	}
}

/** Transição de status que a máquina de estados não permite. */
export class InvalidPollTransition extends Error {
	constructor(from: string, to: string) {
		super(`Uma enquete ${from} não pode passar para ${to}.`);
		this.name = "InvalidPollTransition";
	}
}

/** Voto em enquete que não está aberta. */
export class PollNotOpen extends Error {
	constructor() {
		super("Esta enquete não está aberta para votação.");
		this.name = "PollNotOpen";
	}
}

/** Voto numa opção que não pertence a esta enquete. */
export class OptionNotInPoll extends Error {
	constructor() {
		super("Opção não pertence a esta enquete.");
		this.name = "OptionNotInPoll";
	}
}

/** O mesmo leitor tentando votar duas vezes na mesma enquete. */
export class AlreadyVoted extends Error {
	constructor() {
		super("Você já votou nesta enquete.");
		this.name = "AlreadyVoted";
	}
}

export class PollNotFound extends Error {
	constructor(id: string) {
		super(`Enquete não encontrada: ${id}`);
		this.name = "PollNotFound";
	}
}
