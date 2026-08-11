import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import {
	ColumnistNotFound,
	createColumnist,
	deleteColumnist,
	InMemoryColumnistRepository,
	listColumnists,
	NameRequired,
	reorderColumnists,
	SlugTaken,
	setColumnistActive,
	slugForSignature,
	updateColumnist,
} from "../../src/index";

let repo: InMemoryColumnistRepository;
let deps: { repo: InMemoryColumnistRepository; ids: SequentialIdGenerator };

beforeEach(() => {
	repo = new InMemoryColumnistRepository();
	deps = { repo, ids: new SequentialIdGenerator() };
});

const INPUT = { name: "Mariano Wikoli", beat: "Bastidores da Política" };

describe("createColumnist", () => {
	it("grava e devolve o colunista", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		expect(created.slug).toBe("mariano-wikoli");
		expect(await repo.findBySlug("mariano-wikoli")).not.toBeNull();
	});

	it("põe cada novo no fim do bloco", async () => {
		await createColumnist(INPUT, deps);
		await createColumnist({ name: "Aldo Costa" }, deps);
		const terceiro = (
			await createColumnist({ name: "Daniel Oliveira" }, deps)
		).unwrap();

		expect(terceiro.order).toBe(2);
	});

	it("recusa assinatura já cadastrada", async () => {
		await createColumnist(INPUT, deps);

		expect(await createColumnist({ name: "Mariano Wikoli" }, deps)).toBeErr(
			SlugTaken,
		);
	});

	it("recusa a repetida mesmo escrita diferente", async () => {
		// O caso que a comparação de string crua deixaria passar — e o efeito
		// seria a mesma pessoa duas vezes no bloco da home, apontando para a
		// mesma página de autor.
		await createColumnist(INPUT, deps);

		expect(await createColumnist({ name: "  MARIANO WIKOLÍ  " }, deps)).toBeErr(
			SlugTaken,
		);
	});

	it("propaga o erro do domínio sem gravar nada", async () => {
		expect(await createColumnist({ name: "   " }, deps)).toBeErr(NameRequired);
		expect(await listColumnists(deps)).toHaveLength(0);
	});
});

describe("listColumnists", () => {
	it("ordena por `order` e desempata pelo nome", async () => {
		// Sem o desempate estável, dois colunistas com a mesma ordem trocariam
		// de lugar entre uma consulta e outra.
		const a = (await createColumnist({ name: "Zuleica Alves" }, deps)).unwrap();
		const b = (await createColumnist({ name: "Aldo Costa" }, deps)).unwrap();
		await reorderColumnists(
			{
				orders: [
					{ id: a.id, order: 0 },
					{ id: b.id, order: 0 },
				],
			},
			deps,
		);

		expect((await listColumnists(deps)).map((c) => c.name)).toEqual([
			"Aldo Costa",
			"Zuleica Alves",
		]);
	});

	it("traz também os inativos — o painel precisa dos dois", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();
		await setColumnistActive({ id: created.id, active: false }, deps);

		expect(await listColumnists(deps)).toHaveLength(1);
	});
});

describe("updateColumnist", () => {
	it("atualiza o perfil", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		const updated = (
			await updateColumnist({ id: created.id, blurb: "Toda quinta." }, deps)
		).unwrap();

		expect(updated.blurb).toBe("Toda quinta.");
		expect(updated.beat).toBe("Bastidores da Política");
	});

	it("mantém o endereço quando o nome muda", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		await updateColumnist({ id: created.id, name: "Mariano W. Filho" }, deps);

		// O registro continua alcançável pelo endereço antigo, que é o que as
		// matérias assinadas e o Google conhecem.
		expect(await repo.findBySlug("mariano-wikoli")).not.toBeNull();
	});

	it("reclama de quem não existe", async () => {
		expect(await updateColumnist({ id: "fantasma", name: "X" }, deps)).toBeErr(
			ColumnistNotFound,
		);
	});

	it("propaga o erro do domínio", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		expect(await updateColumnist({ id: created.id, name: " " }, deps)).toBeErr(
			NameRequired,
		);
	});
});

describe("setColumnistActive", () => {
	it("tira do ar e devolve", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		expect(
			(
				await setColumnistActive({ id: created.id, active: false }, deps)
			).unwrap().isActive,
		).toBe(false);
		expect(
			(
				await setColumnistActive({ id: created.id, active: true }, deps)
			).unwrap().isActive,
		).toBe(true);
	});

	it("reclama de quem não existe", async () => {
		expect(
			await setColumnistActive({ id: "fantasma", active: true }, deps),
		).toBeErr(ColumnistNotFound);
	});
});

describe("deleteColumnist", () => {
	it("apaga", async () => {
		const created = (await createColumnist(INPUT, deps)).unwrap();

		await deleteColumnist({ id: created.id }, deps);

		expect(await listColumnists(deps)).toHaveLength(0);
	});

	it("reclama de quem não existe", async () => {
		expect(await deleteColumnist({ id: "fantasma" }, deps)).toBeErr(
			ColumnistNotFound,
		);
	});
});

describe("reorderColumnists", () => {
	it("aplica a ordem informada", async () => {
		const a = (await createColumnist({ name: "Aldo Costa" }, deps)).unwrap();
		const b = (await createColumnist({ name: "Zuleica Alves" }, deps)).unwrap();

		await reorderColumnists(
			{
				orders: [
					{ id: b.id, order: 0 },
					{ id: a.id, order: 1 },
				],
			},
			deps,
		);

		expect((await listColumnists(deps)).map((c) => c.name)).toEqual([
			"Zuleica Alves",
			"Aldo Costa",
		]);
	});

	it("para no primeiro id desconhecido", async () => {
		expect(
			await reorderColumnists({ orders: [{ id: "fantasma", order: 0 }] }, deps),
		).toBeErr(ColumnistNotFound);
	});
});

describe("slugForSignature", () => {
	it("normaliza como o portal indexa quem assina", () => {
		expect(slugForSignature("Mariano Wikolí")).toBe("mariano-wikoli");
	});

	it("devolve null quando não sobra endereço — a tela precisa saber avisar", () => {
		expect(slugForSignature("...")).toBeNull();
	});
});
