import { newPrismaClient } from "@portal-app/db/client";
import {
	InMemorySectionRepository,
	InMemoryTagRepository,
	Section,
	type SectionRepository,
	Tag,
	type TagRepository,
} from "@portal-app/taxonomy";
import { PrismaSectionRepository } from "@portal-app/taxonomy/infrastructure/prisma-section-repository";
import { PrismaTagRepository } from "@portal-app/taxonomy/infrastructure/prisma-tag-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

type SectionHarness = { repo: SectionRepository; reset: () => Promise<void> };

function fakeSections(): SectionHarness {
	const repo = new InMemorySectionRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaSections(): SectionHarness {
	return {
		repo: new PrismaSectionRepository(prisma),
		reset: async () => {
			await prisma.section.deleteMany();
		},
	};
}

function sectionContract(label: string, make: () => SectionHarness): void {
	describe(`SectionRepository — contrato (${label})`, () => {
		let h: SectionHarness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("M05: salva e recupera por id e por slug", async () => {
			const sec = Section.create({
				id: "sec-1",
				name: "Política",
				slug: "politica",
				description: "Brasília",
				color: "#a1b2c3",
				order: 2,
			}).unwrap();
			await h.repo.save(sec);

			const byId = await h.repo.findById("sec-1");
			expect(byId?.name).toBe("Política");
			expect(byId?.slug).toBe("politica");
			expect(byId?.color).toBe("#a1b2c3");
			expect(byId?.order).toBe(2);

			const bySlug = await h.repo.findBySlug("politica");
			expect(bySlug?.id).toBe("sec-1");
		});

		it("persiste a hierarquia (parentId) e a reidrata", async () => {
			const raiz = Section.create({ id: "raiz", name: "Esportes" }).unwrap();
			await h.repo.save(raiz);
			const filha = Section.create({
				id: "filha",
				name: "Futebol",
				parent: raiz,
			}).unwrap();
			await h.repo.save(filha);

			const loaded = await h.repo.findById("filha");
			expect(loaded?.parentId).toBe("raiz");
			expect(loaded?.isRoot()).toBe(false);
		});

		it("lista ordenando por order e depois por nome", async () => {
			await h.repo.save(
				Section.create({ id: "b", name: "B", order: 1 }).unwrap(),
			);
			await h.repo.save(
				Section.create({ id: "a", name: "A", order: 0 }).unwrap(),
			);

			const listed = await h.repo.list();
			expect(listed.map((s) => s.id)).toEqual(["a", "b"]);
		});

		it("exclui e some da busca", async () => {
			await h.repo.save(
				Section.create({ id: "sec-1", name: "Política" }).unwrap(),
			);
			await h.repo.delete("sec-1");

			expect(await h.repo.findById("sec-1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
			expect(await h.repo.findBySlug("nao-existe")).toBeNull();
		});
	});
}

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

type TagHarness = { repo: TagRepository; reset: () => Promise<void> };

function fakeTags(): TagHarness {
	const repo = new InMemoryTagRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaTags(): TagHarness {
	return {
		repo: new PrismaTagRepository(prisma),
		reset: async () => {
			await prisma.tag.deleteMany();
		},
	};
}

function tagContract(label: string, make: () => TagHarness): void {
	describe(`TagRepository — contrato (${label})`, () => {
		let h: TagHarness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("M05: salva e recupera por id e por slug", async () => {
			await h.repo.save(
				Tag.create({ id: "tag-1", name: "Eleições 2026" }).unwrap(),
			);

			const byId = await h.repo.findById("tag-1");
			expect(byId?.name).toBe("Eleições 2026");
			expect(byId?.slug).toBe("eleicoes-2026");

			const bySlug = await h.repo.findBySlug("eleicoes-2026");
			expect(bySlug?.id).toBe("tag-1");
		});

		it("exclui e some da busca", async () => {
			await h.repo.save(Tag.create({ id: "tag-1", name: "Copa" }).unwrap());
			await h.repo.delete("tag-1");

			expect(await h.repo.findById("tag-1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
			expect(await h.repo.findBySlug("nao-existe")).toBeNull();
		});
	});
}

sectionContract("in-memory", fakeSections);
sectionContract("prisma", prismaSections);
tagContract("in-memory", fakeTags);
tagContract("prisma", prismaTags);
