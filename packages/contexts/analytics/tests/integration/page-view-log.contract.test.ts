import {
	InMemoryPageViewLog,
	type PageViewLogPort,
} from "@portal-app/analytics";
import { PrismaPageViewLog } from "@portal-app/analytics/infrastructure/prisma-page-view-log";
import { newPrismaClient } from "@portal-app/db/client";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

/**
 * Contrato de `PageViewLogPort`, rodado contra o fake in-memory E contra o
 * Postgres real (Testcontainers) — é o que legitima usar o fake nos testes da
 * rota de ingestão.
 */

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

const T0 = new Date("2026-08-05T12:00:00-03:00");
const T1 = new Date("2026-08-06T12:00:00-03:00");
const WIDE = {
	from: new Date("2000-01-01T00:00:00Z"),
	to: new Date("2100-01-01T00:00:00Z"),
};

type Harness = { log: PageViewLogPort; reset: () => Promise<void> };

function fake(): Harness {
	const log = new InMemoryPageViewLog();
	return { log, reset: () => Promise.resolve(log.clear()) };
}

function prismaHarness(): Harness {
	return {
		log: new PrismaPageViewLog(prisma),
		reset: async () => {
			await prisma.pageView.deleteMany();
		},
	};
}

function contract(label: string, make: () => Harness): void {
	describe(`PageViewLogPort — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("registra e devolve a visualização", async () => {
			await h.log.record({
				id: "v1",
				articleSlug: "materia-x",
				occurredAt: T0,
				source: "busca",
			});

			const [found] = await h.log.listBetween(WIDE.from, WIDE.to);
			expect(found?.articleSlug).toBe("materia-x");
			expect(found?.source).toBe("busca");
			expect(found?.occurredAt.getTime()).toBe(T0.getTime());
			// Sem o segundo beacon, o tempo de leitura fica em aberto.
			expect(found?.readingSeconds).toBeNull();
		});

		it("fecha o tempo de leitura por id", async () => {
			await h.log.record({
				id: "v1",
				articleSlug: "materia-x",
				occurredAt: T0,
				source: "direto",
			});

			await h.log.setReadingTime("v1", 90);

			const [found] = await h.log.listBetween(WIDE.from, WIDE.to);
			expect(found?.readingSeconds).toBe(90);
		});

		it("registrar de novo o mesmo id não duplica nem apaga o tempo medido", async () => {
			// O browser pode reentregar o beacon de abertura DEPOIS do de saída.
			await h.log.record({
				id: "v1",
				articleSlug: "materia-x",
				occurredAt: T0,
				source: "direto",
			});
			await h.log.setReadingTime("v1", 90);
			await h.log.record({
				id: "v1",
				articleSlug: "materia-x",
				occurredAt: T0,
				source: "direto",
			});

			const found = await h.log.listBetween(WIDE.from, WIDE.to);
			expect(found).toHaveLength(1);
			expect(found[0]?.readingSeconds).toBe(90);
		});

		it("fechar tempo de uma visualização inexistente não estoura", async () => {
			// O primeiro beacon pode ter se perdido — não é motivo para erro.
			await expect(
				h.log.setReadingTime("fantasma", 30),
			).resolves.toBeUndefined();
			expect(await h.log.listBetween(WIDE.from, WIDE.to)).toHaveLength(0);
		});

		it("filtra pelo intervalo, com as duas pontas inclusivas", async () => {
			await h.log.record({
				id: "v0",
				articleSlug: "a",
				occurredAt: T0,
				source: "direto",
			});
			await h.log.record({
				id: "v1",
				articleSlug: "b",
				occurredAt: T1,
				source: "direto",
			});

			const soT0 = await h.log.listBetween(T0, T0);
			expect(soT0.map((v) => v.articleSlug)).toEqual(["a"]);

			const ambos = await h.log.listBetween(T0, T1);
			expect(ambos).toHaveLength(2);
		});

		it("fora do intervalo não aparece", async () => {
			await h.log.record({
				id: "v0",
				articleSlug: "a",
				occurredAt: T0,
				source: "direto",
			});

			const depois = await h.log.listBetween(T1, T1);
			expect(depois).toHaveLength(0);
		});
	});
}

contract("in-memory", fake);
contract("prisma", prismaHarness);

describe("PrismaPageViewLog — dado legado", () => {
	beforeEach(async () => {
		await prisma.pageView.deleteMany();
	});

	it("origem desconhecida no banco vira 'outro' em vez de quebrar a tela", async () => {
		// Simula uma linha gravada por uma versão futura/antiga do app.
		await prisma.pageView.create({
			data: {
				id: "v-legado",
				articleSlug: "materia-x",
				occurredAt: T0,
				source: "categoria-que-nao-existe-mais",
			},
		});

		const [found] = await new PrismaPageViewLog(prisma).listBetween(
			WIDE.from,
			WIDE.to,
		);
		expect(found?.source).toBe("outro");
	});
});
