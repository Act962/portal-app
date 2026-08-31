import { DomainEvent } from "@portal-app/shared-kernel";

/**
 * Eventos de domínio do editorial — fatos no passado. O agregado os acumula via
 * `record()`; o outbox os grava na mesma transação e o despachante (síncrono,
 * node-cron ou Inngest — §5.1 da spec) os entrega. `eventName` é explícito e
 * estável (não deriva de `constructor.name`, que quebra sob minificação).
 */

export class ArticleSubmittedForReview extends DomainEvent {
	readonly eventName = "ArticleSubmittedForReview";
	constructor(
		readonly articleId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class ArticleRejected extends DomainEvent {
	readonly eventName = "ArticleRejected";
	constructor(
		readonly articleId: string,
		readonly reason: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class ArticleScheduled extends DomainEvent {
	readonly eventName = "ArticleScheduled";
	constructor(
		readonly articleId: string,
		readonly at: Date,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class ArticlePublished extends DomainEvent {
	readonly eventName = "ArticlePublished";
	constructor(
		readonly articleId: string,
		readonly slug: string,
		readonly sectionId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class ArticleUpdated extends DomainEvent {
	readonly eventName = "ArticleUpdated";
	constructor(
		readonly articleId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class ArticleUnpublished extends DomainEvent {
	readonly eventName = "ArticleUnpublished";
	constructor(
		readonly articleId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

/**
 * Matéria que NUNCA foi ao ar, arquivada — o rascunho abandonado, a pauta que
 * não vingou.
 *
 * É um evento SEPARADO do `ArticleUnpublished` de propósito, apesar de a
 * transição de estado ser a mesma (→ `ARQUIVADA`). São dois fatos diferentes:
 * "despublicada" significa que havia uma URL viva e ela deixou de existir — o
 * que um dia vai obrigar a revalidar a home, a editoria e o sitemap. Descartar
 * um rascunho não tira nada da web, porque nada estava lá. Um consumidor que
 * reage ao primeiro NÃO pode ser acordado pelo segundo, e um evento só, com
 * bandeira dentro, garantiria que cedo ou tarde alguém esqueceria de olhar a
 * bandeira.
 */
export class ArticleDiscarded extends DomainEvent {
	readonly eventName = "ArticleDiscarded";
	constructor(
		readonly articleId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

/**
 * Matéria APAGADA de vez. O único evento do editorial cujo agregado não existe
 * mais depois dele.
 *
 * Por isso ele carrega `headline` e `slug` no corpo, e não só o id: a linha da
 * auditoria passa a ser o ÚNICO registro de que aquela matéria existiu, e uma
 * auditoria que só sabe dizer "art_7h2k foi apagada" não presta contas de nada.
 * `wasPublished` distingue o descarte de rascunho do apagamento de algo que
 * esteve na web e cujo endereço agora responde 404.
 */
export class ArticleDeleted extends DomainEvent {
	readonly eventName = "ArticleDeleted";
	constructor(
		readonly articleId: string,
		readonly headline: string,
		readonly slug: string,
		readonly wasPublished: boolean,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}
