/**
 * Contrato de um evento de domínio — um fato imutável que já ocorreu. Eventos
 * concretos estendem esta classe (ex.: `class ArticlePublished extends
 * DomainEvent`), com nome no passado e os dados mínimos do fato.
 *
 * O agregado acumula eventos via `record()` e a infraestrutura os publica após
 * a persistência do agregado (outbox) — ver AggregateRoot.
 */
export abstract class DomainEvent {
	/** Instante em que o fato ocorreu. */
	readonly occurredAt: Date;

	protected constructor(occurredAt: Date) {
		this.occurredAt = new Date(occurredAt.getTime());
	}

	/**
	 * Nome estável do evento, no passado (ex.: "ArticlePublished"). Explícito de
	 * propósito: não deriva de `constructor.name`, que quebra sob minificação e
	 * mudaria ao renomear a classe.
	 */
	abstract readonly eventName: string;
}
