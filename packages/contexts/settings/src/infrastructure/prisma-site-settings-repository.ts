import type { PrismaClient } from "@portal-app/db/client";

import type { SiteSettingsRepository } from "../domain/ports/site-settings-repository";
import { SiteSettings } from "../domain/site-settings";

/**
 * Adapter Prisma da porta `SiteSettingsRepository`. Única camada que conhece
 * Prisma. Recebe o cliente por injeção (não o singleton), para rodar contra o
 * Postgres do Testcontainers no mesmo contrato do fake.
 */
export class PrismaSiteSettingsRepository implements SiteSettingsRepository {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Linha ausente não é erro: `fromStored(null)` devolve os defaults (D7). É o
	 * que faz o portal subir inteiro num banco recém-migrado.
	 */
	async load(): Promise<SiteSettings> {
		const row = await this.prisma.siteSettings.findUnique({
			where: { id: SiteSettings.ID },
		});
		return SiteSettings.fromStored(row);
	}

	/**
	 * Persiste o agregado E seus eventos no OUTBOX, na MESMA transação (ADR 0005):
	 * ou tudo entra, ou nada entra. O despacho fica para o relay, depois — é o
	 * mesmo caminho que leva o evento à auditoria (D10).
	 */
	async save(settings: SiteSettings): Promise<void> {
		const events = settings.pullEvents();
		const data = settings.data;

		await this.prisma.$transaction(async (tx) => {
			await tx.siteSettings.upsert({
				where: { id: SiteSettings.ID },
				create: { id: SiteSettings.ID, ...data },
				update: data,
			});

			if (events.length > 0) {
				await tx.outboxEvent.createMany({
					data: events.map((event) => ({
						aggregateId: SiteSettings.ID,
						eventName: event.eventName,
						payload: JSON.parse(JSON.stringify(event)),
						occurredAt: event.occurredAt,
					})),
				});
			}
		});
	}
}
