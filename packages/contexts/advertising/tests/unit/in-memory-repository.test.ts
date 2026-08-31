import {
	Campaign,
	dayKey,
	InMemoryAdStatsCounter,
	InMemoryCampaignRepository,
} from "@portal-app/advertising";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * O FAKE do repositório, testado como código de verdade.
 *
 * Não é zelo com dublê: este fake é o que roda em TODOS os testes de caso de
 * uso, e um filtro errado aqui faria dezenas deles passarem sobre uma verdade
 * que o Postgres não cumpre. O contrato compartilhado com o adapter real está
 * em `tests/integration`; aqui ficam os caminhos que só o fake tem — a fatia
 * de página e a ordenação em memória.
 */

const NOW = new Date("2026-09-15T12:00:00Z");

function campanha(
	id: string,
	overrides: { advertiser?: string; name?: string; createdAt?: Date } = {},
) {
	return Campaign.restore({
		id,
		name: overrides.name ?? `Campanha ${id}`,
		advertiser: overrides.advertiser ?? "Loja do Zé",
		slot: "sidebar",
		destinationUrl: "https://lojadoze.com.br/",
		startsAt: new Date("2026-09-01T00:00:00Z"),
		endsAt: null,
		weight: 1,
		sectionIds: [],
		creative: { mediaId: "m-1", altText: "Anúncio" },
		status: "ATIVA",
		createdAt: overrides.createdAt ?? new Date("2026-08-01T00:00:00Z"),
	});
}

let repo: InMemoryCampaignRepository;

beforeEach(() => {
	repo = new InMemoryCampaignRepository();
});

describe("listagem", () => {
	it("sem página, devolve tudo", async () => {
		await repo.save(campanha("a"));
		await repo.save(campanha("b"));
		expect(await repo.list()).toHaveLength(2);
	});

	it("com página, corta a fatia pedida", async () => {
		for (const id of ["a", "b", "c"]) {
			await repo.save(campanha(id));
		}
		expect(await repo.list(undefined, { limit: 2, offset: 0 })).toHaveLength(2);
		expect(await repo.list(undefined, { limit: 2, offset: 2 })).toHaveLength(1);
		// Além do fim, a lista volta vazia — e isso é normal, não erro.
		expect(await repo.list(undefined, { limit: 2, offset: 10 })).toHaveLength(
			0,
		);
	});

	it("ordena da mais nova para a mais velha", async () => {
		await repo.save(campanha("velha", { createdAt: new Date("2026-01-01") }));
		await repo.save(campanha("nova", { createdAt: new Date("2026-08-01") }));
		expect((await repo.list()).map((c) => c.id)).toEqual(["nova", "velha"]);
	});

	it("filtra por anunciante exato", async () => {
		await repo.save(campanha("a", { advertiser: "Padaria Central" }));
		await repo.save(campanha("b", { advertiser: "Loja do Zé" }));
		const achadas = await repo.list({ advertiser: "Padaria Central" });
		expect(achadas.map((c) => c.id)).toEqual(["a"]);
	});

	it("a busca é insensível a caixa e olha nome E anunciante", async () => {
		await repo.save(campanha("a", { name: "Verão 2026" }));
		await repo.save(campanha("b", { advertiser: "Padaria Central" }));
		expect((await repo.list({ search: "VERÃO" })).map((c) => c.id)).toEqual([
			"a",
		]);
		expect((await repo.list({ search: "padaria" })).map((c) => c.id)).toEqual([
			"b",
		]);
		expect(await repo.list({ search: "   " })).toHaveLength(2);
	});

	it("count concorda com list — sempre", async () => {
		// Divergir aqui faz a última página aparecer vazia sem explicação.
		await repo.save(campanha("a", { name: "Verão" }));
		await repo.save(campanha("b", { name: "Inverno" }));
		const filtro = { search: "verão" };
		expect(await repo.count(filtro)).toBe((await repo.list(filtro)).length);
	});

	it("clear esvazia", async () => {
		await repo.save(campanha("a"));
		repo.clear();
		expect(await repo.count()).toBe(0);
	});
});

describe("contador em memória", () => {
	it("separa por DIA", async () => {
		const stats = new InMemoryAdStatsCounter();
		await stats.recordImpression("c-1", new Date("2026-09-14T23:00:00Z"));
		await stats.recordImpression("c-1", new Date("2026-09-15T01:00:00Z"));
		const [total] = await stats.statsFor(
			["c-1"],
			new Date("2026-09-01T00:00:00Z"),
			new Date("2026-10-01T00:00:00Z"),
		);
		expect(total?.impressions).toBe(2);
	});

	it("ignora evento de campanha que não foi pedida", async () => {
		const stats = new InMemoryAdStatsCounter();
		await stats.recordClick("outra", NOW);
		const [total] = await stats.statsFor(
			["c-1"],
			new Date("2026-09-01T00:00:00Z"),
			new Date("2026-10-01T00:00:00Z"),
		);
		expect(total).toEqual({ campaignId: "c-1", impressions: 0, clicks: 0 });
	});

	it("clear esvazia", async () => {
		const stats = new InMemoryAdStatsCounter();
		await stats.recordClick("c-1", NOW);
		stats.clear();
		const [total] = await stats.statsFor(
			["c-1"],
			new Date("2026-01-01"),
			new Date("2027-01-01"),
		);
		expect(total?.clicks).toBe(0);
	});
});

describe("dayKey", () => {
	it("é o dia UTC, e o mesmo corte que o adapter Prisma usa", () => {
		// Um lado em UTC e o outro no fuso local faria o relatório de "ontem"
		// mudar conforme onde o código roda.
		expect(dayKey(new Date("2026-09-15T23:59:59Z"))).toBe("2026-09-15");
		expect(dayKey(new Date("2026-09-16T00:00:00Z"))).toBe("2026-09-16");
	});
});
