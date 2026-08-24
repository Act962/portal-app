import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	CannotMergeIntoItself,
	createTag,
	deleteTag,
	InMemoryTagRepository,
	listTags,
	mergeTags,
	renameTag,
	SlugTaken,
	StubNoUsage,
	TagInUse,
	TagNotFound,
} from "@portal-app/taxonomy";
import { beforeEach, describe, expect, it } from "vitest";

let repo: InMemoryTagRepository;
let deps: {
	repo: InMemoryTagRepository;
	usage: StubNoUsage;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	repo = new InMemoryTagRepository();
	deps = {
		repo,
		usage: new StubNoUsage(),
		ids: new SequentialIdGenerator("tag"),
	};
});

describe("createTag", () => {
	it("cria com slug derivado", async () => {
		const tag = (await createTag({ name: "Eleições 2026" }, deps)).unwrap();

		expect(tag.slug).toBe("eleicoes-2026");
	});

	it("rejeita slug duplicado (SlugTaken)", async () => {
		await createTag({ name: "Copa" }, deps);
		const dup = await createTag({ name: "Copa" }, deps);

		expect(dup.unwrapErr()).toBeInstanceOf(SlugTaken);
	});
});

describe("renameTag", () => {
	it("renomeia", async () => {
		const tag = (await createTag({ name: "Eleição" }, deps)).unwrap();
		const renamed = (
			await renameTag({ id: tag.id, name: "Pleito" }, deps)
		).unwrap();

		expect(renamed.name).toBe("Pleito");
	});

	it("erro em tag inexistente", async () => {
		expect(
			(await renameTag({ id: "x", name: "y" }, deps)).unwrapErr(),
		).toBeInstanceOf(TagNotFound);
	});
});

describe("deleteTag", () => {
	it("exclui tag sem uso", async () => {
		const tag = (await createTag({ name: "Copa" }, deps)).unwrap();
		await deleteTag({ id: tag.id }, deps);

		expect((await listTags(deps)).length).toBe(0);
	});

	it("recusa exclusão de tag em uso (TagInUse)", async () => {
		const tag = (await createTag({ name: "Copa" }, deps)).unwrap();
		const inUse = {
			repo,
			usage: {
				sectionHasPublishedContent: () => Promise.resolve(false),
				tagHasPublishedContent: () => Promise.resolve(true),
			},
		};
		expect((await deleteTag({ id: tag.id }, inUse)).unwrapErr()).toBeInstanceOf(
			TagInUse,
		);
	});

	it("erro em tag inexistente", async () => {
		expect((await deleteTag({ id: "x" }, deps)).unwrapErr()).toBeInstanceOf(
			TagNotFound,
		);
	});
});

describe("mergeTags (A19, parcial nesta fase — D3)", () => {
	it("mescla removendo a origem sem uso e mantendo o alvo", async () => {
		const source = (await createTag({ name: "Eleicoes" }, deps)).unwrap();
		const target = (await createTag({ name: "Eleições 2026" }, deps)).unwrap();

		const merged = (
			await mergeTags({ sourceId: source.id, targetId: target.id }, deps)
		).unwrap();

		expect(merged.id).toBe(target.id);
		expect(await repo.findById(source.id)).toBeNull();
	});

	it("recusa mesclar uma tag nela mesma", async () => {
		const tag = (await createTag({ name: "Copa" }, deps)).unwrap();
		const result = await mergeTags(
			{ sourceId: tag.id, targetId: tag.id },
			deps,
		);

		expect(result.unwrapErr()).toBeInstanceOf(CannotMergeIntoItself);
	});

	it("erro se origem ou alvo não existem", async () => {
		const target = (await createTag({ name: "Copa" }, deps)).unwrap();

		expect(
			(
				await mergeTags({ sourceId: "x", targetId: target.id }, deps)
			).unwrapErr(),
		).toBeInstanceOf(TagNotFound);
		expect(
			(
				await mergeTags({ sourceId: target.id, targetId: "y" }, deps)
			).unwrapErr(),
		).toBeInstanceOf(TagNotFound);
	});

	it("recusa mesclar origem em uso (reatribuição só na Fase 3)", async () => {
		const source = (await createTag({ name: "A" }, deps)).unwrap();
		const target = (await createTag({ name: "B" }, deps)).unwrap();
		const inUse = {
			repo,
			usage: {
				sectionHasPublishedContent: () => Promise.resolve(false),
				tagHasPublishedContent: () => Promise.resolve(true),
			},
		};
		expect(
			(
				await mergeTags({ sourceId: source.id, targetId: target.id }, inUse)
			).unwrapErr(),
		).toBeInstanceOf(TagInUse);
	});
});
