import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import {
	createProgram,
	deleteProgram,
	InMemoryProgramRepository,
	listPrograms,
	ProgramNotFound,
	reorderPrograms,
	updateProgram,
} from "../../src/index";

let repo: InMemoryProgramRepository;
let deps: { repo: InMemoryProgramRepository; ids: SequentialIdGenerator };

beforeEach(() => {
	repo = new InMemoryProgramRepository();
	deps = { repo, ids: new SequentialIdGenerator() };
});

const INPUT = {
	name: "Manhã 7 Cidades",
	host: "Léo Martins",
	dayOfWeek: 1,
	startTime: "06:00",
	endTime: "09:00",
};

describe("createProgram", () => {
	it("cria e persiste, entrando no fim da ordenação", async () => {
		await createProgram(INPUT, deps);
		const result = await createProgram(
			{ ...INPUT, name: "Giro de Notícias", startTime: "09:00", endTime: "10:00" },
			deps,
		);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().order).toBe(1);
		expect(await repo.list()).toHaveLength(2);
	});

	it("propaga erro de domínio sem persistir", async () => {
		const result = await createProgram({ ...INPUT, name: "" }, deps);

		expect(result.isErr()).toBe(true);
		expect(await repo.list()).toHaveLength(0);
	});
});

describe("updateProgram", () => {
	it("edita um programa existente", async () => {
		const created = (await createProgram(INPUT, deps)).unwrap();

		const result = await updateProgram({ id: created.id, host: "Novo Locutor" }, deps);

		expect(result.isOk()).toBe(true);
		expect((await repo.findById(created.id))?.host).toBe("Novo Locutor");
	});

	it("devolve ProgramNotFound para id inexistente", async () => {
		const result = await updateProgram({ id: "fantasma", host: "X" }, deps);
		expect(result).toBeErr(ProgramNotFound);
	});
});

describe("deleteProgram", () => {
	it("remove o programa", async () => {
		const created = (await createProgram(INPUT, deps)).unwrap();

		const result = await deleteProgram({ id: created.id }, deps);

		expect(result.isOk()).toBe(true);
		expect(await repo.findById(created.id)).toBeNull();
	});

	it("devolve ProgramNotFound para id inexistente", async () => {
		const result = await deleteProgram({ id: "fantasma" }, deps);
		expect(result).toBeErr(ProgramNotFound);
	});
});

describe("reorderPrograms", () => {
	it("aplica a nova ordem a todos os ids informados", async () => {
		const a = (await createProgram(INPUT, deps)).unwrap();
		const b = (
			await createProgram(
				{ ...INPUT, name: "Giro", startTime: "09:00", endTime: "10:00" },
				deps,
			)
		).unwrap();

		await reorderPrograms(
			{
				orders: [
					{ id: a.id, order: 1 },
					{ id: b.id, order: 0 },
				],
			},
			deps,
		);

		expect((await repo.findById(a.id))?.order).toBe(1);
		expect((await repo.findById(b.id))?.order).toBe(0);
	});
});

describe("listPrograms", () => {
	it("lista os programas cadastrados", async () => {
		await createProgram(INPUT, deps);
		expect(await listPrograms(deps)).toHaveLength(1);
	});
});
