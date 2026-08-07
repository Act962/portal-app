import { describe, expect, it } from "vitest";

import { InMemoryViewCounter } from "../../src/index";

const NOW = new Date("2026-08-06T18:00:00-03:00");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("InMemoryViewCounter — topSlugs", () => {
	it("ordena do mais visto para o menos visto", async () => {
		const counter = new InMemoryViewCounter();
		await counter.recordView("a", NOW);
		await counter.recordView("b", NOW);
		await counter.recordView("b", NOW);
		await counter.recordView("c", NOW);
		await counter.recordView("c", NOW);
		await counter.recordView("c", NOW);

		expect(await counter.topSlugs(5, NOW)).toEqual(["c", "b", "a"]);
	});

	it("respeita o limite pedido", async () => {
		const counter = new InMemoryViewCounter();
		await counter.recordView("a", NOW);
		await counter.recordView("b", NOW);
		await counter.recordView("c", NOW);

		expect(await counter.topSlugs(2, NOW)).toHaveLength(2);
	});

	it("ignora visualização fora da janela de 24h", async () => {
		const counter = new InMemoryViewCounter();
		const vinte5horasAntes = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
		await counter.recordView("velha", vinte5horasAntes);
		await counter.recordView("nova", NOW);

		expect(await counter.topSlugs(5, NOW)).toEqual(["nova"]);
	});

	it("visualização exatamente no limite da janela (24h atrás) ainda conta", async () => {
		const counter = new InMemoryViewCounter();
		await counter.recordView("no-limite", new Date(NOW.getTime() - DAY_MS));

		expect(await counter.topSlugs(5, NOW)).toEqual(["no-limite"]);
	});

	it("sem visualização nenhuma devolve lista vazia — quem chama decide o fallback", async () => {
		const counter = new InMemoryViewCounter();
		expect(await counter.topSlugs(5, NOW)).toEqual([]);
	});

	it("empate mantém as duas matérias na lista", async () => {
		const counter = new InMemoryViewCounter();
		await counter.recordView("a", NOW);
		await counter.recordView("b", NOW);

		const ranked = await counter.topSlugs(5, NOW);
		expect(ranked).toHaveLength(2);
		expect(ranked).toEqual(expect.arrayContaining(["a", "b"]));
	});
});
