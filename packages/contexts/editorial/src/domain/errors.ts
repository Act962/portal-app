import type { EditorialStatus } from "./editorial-status";

/**
 * Erros de regra do contexto editorial. VALORES devolvidos em `Result` — não
 * exceções. As pendências de publicação (capa/alt-text/editoria/corpo) são
 * listáveis para a UI mostrar ANTES do clique (A04).
 */

export class ArticleNotFound extends Error {
	constructor(id: string) {
		super(`Matéria não encontrada: ${id}`);
		this.name = "ArticleNotFound";
	}
}

export class HeadlineRequired extends Error {
	constructor() {
		super("A matéria precisa de título.");
		this.name = "HeadlineRequired";
	}
}

export class BylineRequired extends Error {
	constructor() {
		super("A matéria precisa de um autor (assinatura).");
		this.name = "BylineRequired";
	}
}

export class InvalidSlug extends Error {
	constructor(raw: string) {
		super(`Não foi possível gerar um slug válido a partir de "${raw}".`);
		this.name = "InvalidSlug";
	}
}

/** Slug não muda depois da primeira publicação — a URL não pode quebrar. */
export class SlugImmutable extends Error {
	constructor() {
		super("O slug não pode mudar após a primeira publicação.");
		this.name = "SlugImmutable";
	}
}

export class InvalidBlock extends Error {
	constructor(reason: string) {
		super(`Bloco de conteúdo inválido: ${reason}`);
		this.name = "InvalidBlock";
	}
}

/** Transição de estado não permitida pela máquina de estados. */
export class InvalidTransition extends Error {
	readonly from: EditorialStatus;
	readonly to: EditorialStatus;
	constructor(from: EditorialStatus, to: EditorialStatus) {
		super(`Transição inválida: ${from} → ${to}.`);
		this.name = "InvalidTransition";
		this.from = from;
		this.to = to;
	}
}

/** Devolver da revisão exige motivo (A03). */
export class RejectionReasonRequired extends Error {
	constructor() {
		super("A devolução para o autor exige um motivo.");
		this.name = "RejectionReasonRequired";
	}
}

/**
 * Matéria no ar não se apaga.
 *
 * Não é zelo excessivo: o endereço dela está indexado no Google, colado em
 * grupo de WhatsApp e linkado por outros sites. Apagar transforma tudo isso em
 * 404 de uma vez. ARQUIVAR tira do portal e preserva o registro — quem quiser
 * mesmo eliminar passa por lá primeiro, e essa segunda parada é justamente o
 * ponto em que dá para mudar de ideia.
 */
export class ArticleOnAir extends Error {
	constructor() {
		super(
			"Matéria no ar não pode ser apagada: arquive primeiro para tirá-la do portal.",
		);
		this.name = "ArticleOnAir";
	}
}

/** Só se agenda para o futuro (A12). */
export class ScheduleInPast extends Error {
	constructor() {
		super("O agendamento precisa ser no futuro.");
		this.name = "ScheduleInPast";
	}
}

// --- Pendências de publicação (A04): faltam para poder publicar. -------------

export class BodyRequired extends Error {
	constructor() {
		super("A matéria precisa de corpo para publicar.");
		this.name = "BodyRequired";
	}
}

export class SectionRequired extends Error {
	constructor() {
		super("A matéria precisa de editoria para publicar.");
		this.name = "SectionRequired";
	}
}

export class CoverImageRequired extends Error {
	constructor() {
		super("A matéria precisa de imagem de capa para publicar.");
		this.name = "CoverImageRequired";
	}
}

export class AltTextRequired extends Error {
	constructor() {
		super("A imagem de capa precisa de texto alternativo para publicar.");
		this.name = "AltTextRequired";
	}
}

/** Erros que impedem publicar — a UI os lista antes do clique. */
export type PublishBlocker =
	| BodyRequired
	| SectionRequired
	| CoverImageRequired
	| AltTextRequired;
