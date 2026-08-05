/**
 * Um evento já persistido no outbox, pronto para ser entregue. É a forma
 * serializável do `DomainEvent` (nome + payload plano), independente de quem
 * despacha — síncrono, node-cron ou Inngest (§5.1 da spec).
 */
export type OutboxRecord = {
	id: string;
	aggregateId: string;
	eventName: string;
	payload: unknown;
	occurredAt: Date;
};

/**
 * Porta de DESPACHO de eventos. O núcleo nunca conhece o despachante concreto:
 * é aqui que Inngest, um bus síncrono ou node-cron se encaixam como adapters
 * intercambiáveis. Trocar de despachante é trocar a linha da composição.
 */
export interface EventBus {
	publish(record: OutboxRecord): Promise<void>;
}

export type EventHandler = (record: OutboxRecord) => Promise<void> | void;

/**
 * Adapter SÍNCRONO/in-process — o default de dev e o mais simples: entrega o
 * evento aos handlers registrados, na hora. Prova que a aplicação não depende do
 * Inngest; um `node-cron` ou o Inngest cumprem a MESMA porta.
 */
export class SyncEventBus implements EventBus {
	private readonly handlers = new Map<string, EventHandler[]>();

	on(eventName: string, handler: EventHandler): this {
		const list = this.handlers.get(eventName) ?? [];
		list.push(handler);
		this.handlers.set(eventName, list);
		return this;
	}

	async publish(record: OutboxRecord): Promise<void> {
		for (const handler of this.handlers.get(record.eventName) ?? []) {
			await handler(record);
		}
	}
}

/** Fake de teste: apenas coleta o que foi entregue, para asserção. */
export class InMemoryEventBus implements EventBus {
	readonly delivered: OutboxRecord[] = [];

	publish(record: OutboxRecord): Promise<void> {
		this.delivered.push(record);
		return Promise.resolve();
	}
}
