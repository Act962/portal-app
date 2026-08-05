import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	InMemorySectionRepository,
	MaxDepthExceeded,
	SectionInUse,
	SectionNotFound,
	SlugTaken,
	StubNoUsage,
	createSection,
	deleteSection,
	listSections,
	reorderSections,
	setSectionActive,
	updateSection,
} from "@portal-app/taxonomy";
import { beforeEach, describe, expect, it } from "vitest";

let repo: InMemorySectionRepository;
let deps: {
	repo: InMemorySectionRepository;
	usage: StubNoUsage;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	repo = new InMemorySectionRepository();
	deps = { repo, usage: new StubNoUsage(), ids: new SequentialIdGenerator("sec") };
});

describe("createSection", () => {
	it("cria com slug derivado e ordem no fim da lista", async () => {
		await createSection({ name: "Política" }, deps);
		const second = (await createSection({ name: "Esportes" }, deps)).unwrap();

		expect(second.slug).toBe("esportes");
		expect(second.order).toBe(1);
		expect((await listSections(deps)).length).toBe(2);
	});

	it("M03: rejeita slug duplicado (SlugTaken)", async () => {
		await createSection({ name: "Política" }, deps);
		const dup = await createSection({ name: "Política" }, deps);

		expect(dup.unwrapErr()).toBeInstanceOf(SlugTaken);
	});

	it("cria subeditoria sob uma raiz", async () => {
		const raiz = (await createSection({ name: "Esportes" }, deps)).unwrap();
		const filha = (await createSection({ name: "Futebol", parentId: raiz.id }, deps)).unwrap();

		expect(filha.parentId).toBe(raiz.id);
	});

	it("rejeita subeditoria de subeditoria (MaxDepthExceeded)", async () => {
		const raiz = (await createSection({ name: "Esportes" }, deps)).unwrap();
		const filha = (await createSection({ name: "Futebol", parentId: raiz.id }, deps)).unwrap();
		const neta = await createSection({ name: "Copa", parentId: filha.id }, deps);

		expect(neta.unwrapErr()).toBeInstanceOf(MaxDepthExceeded);
	});

	it("rejeita mãe inexistente (SectionNotFound)", async () => {
		const orphan = await createSection({ name: "Futebol", parentId: "nao-existe" }, deps);

		expect(orphan.unwrapErr()).toBeInstanceOf(SectionNotFound);
	});
});

describe("updateSection / setSectionActive", () => {
	it("edita os detalhes de uma editoria existente", async () => {
		const sec = (await createSection({ name: "Política" }, deps)).unwrap();
		const updated = (await updateSection({ id: sec.id, name: "Política Nacional" }, deps)).unwrap();

		expect(updated.name).toBe("Política Nacional");
	});

	it("desativa e reativa", async () => {
		const sec = (await createSection({ name: "Política" }, deps)).unwrap();

		expect((await setSectionActive({ id: sec.id, active: false }, deps)).unwrap().isActive()).toBe(
			false,
		);
		expect((await setSectionActive({ id: sec.id, active: true }, deps)).unwrap().isActive()).toBe(
			true,
		);
	});

	it("erro ao editar editoria inexistente", async () => {
		expect((await updateSection({ id: "x", name: "y" }, deps)).unwrapErr()).toBeInstanceOf(
			SectionNotFound,
		);
		expect((await setSectionActive({ id: "x", active: true }, deps)).unwrapErr()).toBeInstanceOf(
			SectionNotFound,
		);
	});
});

describe("reorderSections", () => {
	it("aplica a nova ordem", async () => {
		const a = (await createSection({ name: "A" }, deps)).unwrap();
		const b = (await createSection({ name: "B" }, deps)).unwrap();

		await reorderSections({ orders: [{ id: a.id, order: 10 }, { id: b.id, order: 5 }] }, deps);
		const listed = await listSections(deps);

		expect(listed.map((s) => s.id)).toEqual([b.id, a.id]);
	});

	it("erro se algum id não existe", async () => {
		const result = await reorderSections({ orders: [{ id: "x", order: 0 }] }, deps);

		expect(result.unwrapErr()).toBeInstanceOf(SectionNotFound);
	});
});

describe("deleteSection (A17 via porta de uso)", () => {
	it("exclui editoria sem uso", async () => {
		const sec = (await createSection({ name: "Política" }, deps)).unwrap();
		const result = await deleteSection({ id: sec.id }, deps);

		expect(result.isOk()).toBe(true);
		expect((await listSections(deps)).length).toBe(0);
	});

	it("M04: recusa exclusão de editoria em uso (SectionInUse)", async () => {
		const sec = (await createSection({ name: "Política" }, deps)).unwrap();
		const inUse = {
			repo,
			usage: {
				sectionHasPublishedContent: () => Promise.resolve(true),
				tagHasPublishedContent: () => Promise.resolve(false),
			},
		};
		const result = await deleteSection({ id: sec.id }, inUse);

		expect(result.unwrapErr()).toBeInstanceOf(SectionInUse);
	});

	it("erro ao excluir editoria inexistente", async () => {
		expect((await deleteSection({ id: "x" }, deps)).unwrapErr()).toBeInstanceOf(SectionNotFound);
	});
});
