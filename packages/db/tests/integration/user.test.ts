import { newPrismaClient } from "@portal-app/db/client";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

beforeEach(async () => {
	await prisma.user.deleteMany();
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe("integração: banco e migrações", () => {
	it("T05: as migrações criam a tabela user num Postgres limpo", async () => {
		const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'user'
		`;

		expect(rows).toHaveLength(1);
	});

	it("T06: escreve e lê um usuário", async () => {
		await prisma.user.create({
			data: { id: "u-1", name: "Redação", email: "redacao@example.com" },
		});

		const found = await prisma.user.findUnique({ where: { id: "u-1" } });

		expect(found?.email).toBe("redacao@example.com");
		expect(found?.createdAt).toBeInstanceOf(Date);
	});

	it("T07: rollback isola um teste do seguinte", async () => {
		class Rollback extends Error {}

		await expect(
			prisma.$transaction(async (tx) => {
				await tx.user.create({
					data: { id: "u-tx", name: "Temp", email: "temp@example.com" },
				});
				expect(await tx.user.count()).toBe(1);
				throw new Rollback();
			}),
		).rejects.toThrow(Rollback);

		// O insert acima foi desfeito: o banco continua vazio para o próximo teste.
		expect(await prisma.user.count()).toBe(0);
	});
});
