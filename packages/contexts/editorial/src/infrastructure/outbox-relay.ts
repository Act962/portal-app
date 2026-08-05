import type { PrismaClient } from "@portal-app/db/client";

import type { EventBus } from "../domain/ports/event-bus";

/**
 * Relay do outbox: lê os eventos pendentes e os entrega pelo `EventBus`,
 * marcando cada um como processado. A marcação dá IDEMPOTÊNCIA — um segundo
 * despacho não reentrega o que já saiu (A13).
 *
 * Quem CHAMA este relay é a composição, e é aí que a §5.1 se materializa: um
 * loop síncrono, um `node-cron`, ou uma função Inngest podem dirigi-lo sem que o
 * núcleo saiba qual é. Devolve quantos eventos foram despachados nesta rodada.
 */
export async function dispatchOutbox(
	prisma: PrismaClient,
	bus: EventBus,
	batchSize = 100,
): Promise<number> {
	const pending = await prisma.outboxEvent.findMany({
		where: { processedAt: null },
		orderBy: { createdAt: "asc" },
		take: batchSize,
	});

	for (const row of pending) {
		await bus.publish({
			id: row.id,
			aggregateId: row.aggregateId,
			eventName: row.eventName,
			payload: row.payload,
			occurredAt: row.occurredAt,
		});
		await prisma.outboxEvent.update({
			where: { id: row.id },
			data: { processedAt: new Date() },
		});
	}

	return pending.length;
}
