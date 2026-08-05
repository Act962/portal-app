import { InMemoryEventBus, SyncEventBus } from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

const record = {
	id: "e-1",
	aggregateId: "art-1",
	eventName: "ArticlePublished",
	payload: { slug: "x" },
	occurredAt: new Date("2026-08-05T12:00:00Z"),
};

describe("SyncEventBus (adapter síncrono)", () => {
	it("entrega o evento aos handlers registrados para o nome", async () => {
		const seen: string[] = [];
		const bus = new SyncEventBus()
			.on("ArticlePublished", (r) => {
				seen.push(`a:${r.aggregateId}`);
			})
			.on("ArticlePublished", async (r) => {
				seen.push(`b:${r.eventName}`);
			});

		await bus.publish(record);
		expect(seen).toEqual(["a:art-1", "b:ArticlePublished"]);
	});

	it("é no-op para um nome sem handlers", async () => {
		const bus = new SyncEventBus();
		await expect(bus.publish(record)).resolves.toBeUndefined();
	});
});

describe("InMemoryEventBus (fake)", () => {
	it("coleta o que foi entregue", async () => {
		const bus = new InMemoryEventBus();
		await bus.publish(record);
		expect(bus.delivered).toHaveLength(1);
		expect(bus.delivered[0]?.eventName).toBe("ArticlePublished");
	});
});
