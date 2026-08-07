import {
	InMemoryViewCounter,
	type ViewCounterPort,
} from "@portal-app/analytics";
import { RedisViewCounter } from "@portal-app/analytics/infrastructure/redis-view-counter";
import { Redis } from "ioredis";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Contrato de `ViewCounterPort`, rodado contra o fake in-memory E contra um
 * Redis real (Testcontainers) — mesmo espírito do contrato de `MediaStorage`
 * contra o MinIO: sem conta em serviço nenhum, exercitando o código real do
 * adapter (pipeline, TTL, `tracked-slugs`).
 */

const NOW = new Date("2026-08-06T18:00:00-03:00");

let container: StartedTestContainer;
let redis: Redis;

beforeAll(async () => {
	container = await new GenericContainer("redis:7-alpine")
		.withExposedPorts(6379)
		.start();
	redis = new Redis({
		host: container.getHost(),
		port: container.getMappedPort(6379),
	});
}, 60_000);

afterAll(async () => {
	redis.disconnect();
	await container.stop();
});

type Harness = { counter: ViewCounterPort; reset: () => Promise<void> };

function fakeHarness(): Harness {
	const counter = new InMemoryViewCounter();
	return { counter, reset: () => Promise.resolve(counter.clear()) };
}

function redisHarness(): Harness {
	return {
		counter: new RedisViewCounter(redis),
		reset: async () => {
			await redis.flushall();
		},
	};
}

function contract(label: string, make: () => Harness): void {
	describe(`ViewCounterPort — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("ordena do mais visto para o menos visto", async () => {
			await h.counter.recordView("a", NOW);
			await h.counter.recordView("b", NOW);
			await h.counter.recordView("b", NOW);
			await h.counter.recordView("c", NOW);
			await h.counter.recordView("c", NOW);
			await h.counter.recordView("c", NOW);

			expect(await h.counter.topSlugs(5, NOW)).toEqual(["c", "b", "a"]);
		});

		it("respeita o limite pedido", async () => {
			await h.counter.recordView("a", NOW);
			await h.counter.recordView("b", NOW);
			await h.counter.recordView("c", NOW);

			expect(await h.counter.topSlugs(2, NOW)).toHaveLength(2);
		});

		it("ignora visualização fora da janela de 24h", async () => {
			const antesDaJanela = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
			await h.counter.recordView("velha", antesDaJanela);
			await h.counter.recordView("nova", NOW);

			expect(await h.counter.topSlugs(5, NOW)).toEqual(["nova"]);
		});

		it("sem visualização nenhuma devolve lista vazia", async () => {
			expect(await h.counter.topSlugs(5, NOW)).toEqual([]);
		});
	});
}

contract("in-memory", fakeHarness);
contract("redis", redisHarness);
