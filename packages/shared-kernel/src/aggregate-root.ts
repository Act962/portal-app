import type { DomainEvent } from "./domain-event";
import { Entity } from "./entity";

/**
 * AggregateRoot — a entidade que é porta de entrada de um agregado e a única
 * que emite eventos de domínio. Acumula eventos durante a operação e os entrega
 * à infraestrutura, que os publica logo após persistir o agregado.
 */
export abstract class AggregateRoot<Id> extends Entity<Id> {
	private readonly domainEvents: DomainEvent[] = [];

	/** Registra um evento a ser publicado após a persistência do agregado. */
	protected record(event: DomainEvent): void {
		this.domainEvents.push(event);
	}

	/**
	 * Devolve os eventos acumulados e esvazia a fila. Chamado pela camada de
	 * infraestrutura logo após salvar o agregado, na mesma transação (outbox).
	 * Esvaziar aqui garante que o mesmo evento não seja publicado duas vezes.
	 */
	pullEvents(): DomainEvent[] {
		const events = [...this.domainEvents];
		this.domainEvents.length = 0;
		return events;
	}
}
