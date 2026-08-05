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
