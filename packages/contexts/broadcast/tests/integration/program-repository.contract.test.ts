import { InMemoryProgramRepository, Program, type ProgramRepository } from "@portal-app/broadcast";
import { PrismaProgramRepository } from "@portal-app/broadcast/infrastructure/prisma-program-repository";
import { newPrismaClient } from "@portal-app/db/client";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

type Harness = { repo: ProgramRepository; reset: () => Promise<void> };

function fake(): Harness {
	const repo = new InMemoryProgramRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaHarness(): Harness {
	return {
		repo: new PrismaProgramRepository(prisma),
		reset: async () => {
			await prisma.program.deleteMany();
		},
	};
}

function contract(label: string, make: () => Harness): void {
	describe(`ProgramRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("salva e recupera por id", async () => {
			const program = Program.create({
				id: "prog-1",
				name: "Manhã 7 Cidades",
				host: "Léo Martins",
				dayOfWeek: 1,
				startTime: "06:00",
				endTime: "09:00",
				order: 2,
			}).unwrap();
			await h.repo.save(program);

			const loaded = await h.repo.findById("prog-1");
			expect(loaded?.name).toBe("Manhã 7 Cidades");
			expect(loaded?.host).toBe("Léo Martins");
			expect(loaded?.dayOfWeek).toBe(1);
			expect(loaded?.startTime).toBe("06:00");
			expect(loaded?.endTime).toBe("09:00");
			expect(loaded?.order).toBe(2);
		});

		it("save é upsert — salvar de novo atualiza, não duplica", async () => {
			const program = Program.create({
				id: "prog-1",
				name: "Manhã 7 Cidades",
				host: "Léo Martins",
				dayOfWeek: 1,
				startTime: "06:00",
				endTime: "09:00",
			}).unwrap();
			await h.repo.save(program);

			program.updateDetails({ host: "Novo Locutor" });
			await h.repo.save(program);

			expect(await h.repo.list()).toHaveLength(1);
			expect((await h.repo.findById("prog-1"))?.host).toBe("Novo Locutor");
		});

		it("lista ordenando por dia da semana, depois horário de início", async () => {
			await h.repo.save(
				Program.create({
					id: "b",
					name: "Tarde",
					host: "X",
					dayOfWeek: 2,
					startTime: "09:00",
					endTime: "10:00",
				}).unwrap(),
			);
			await h.repo.save(
				Program.create({
					id: "a",
					name: "Manhã",
					host: "X",
					dayOfWeek: 1,
					startTime: "06:00",
					endTime: "09:00",
				}).unwrap(),
			);

			const listed = await h.repo.list();
			expect(listed.map((p) => p.id)).toEqual(["a", "b"]);
		});

		it("exclui e some da busca", async () => {
			await h.repo.save(
				Program.create({
					id: "prog-1",
					name: "Manhã",
					host: "X",
					dayOfWeek: 1,
					startTime: "06:00",
					endTime: "09:00",
				}).unwrap(),
			);
			await h.repo.delete("prog-1");

			expect(await h.repo.findById("prog-1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fake);
contract("prisma", prismaHarness);
