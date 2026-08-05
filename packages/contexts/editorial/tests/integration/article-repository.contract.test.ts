import { newPrismaClient } from "@portal-app/db/client";
import {
	Article,
	type ArticleRepository,
	InMemoryArticleRepository,
} from "@portal-app/editorial";
import { PrismaArticleRepository } from "@portal-app/editorial/infrastructure/prisma-article-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

type Harness = { repo: ArticleRepository; reset: () => Promise<void> };

function fakeHarness(): Harness {
	const repo = new InMemoryArticleRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaHarness(): Harness {
	return {
		repo: new PrismaArticleRepository(prisma),
		reset: async () => {
			await prisma.article.deleteMany();
		},
	};
}

const NOW = new Date("2026-08-05T12:00:00Z");

/** Cria um rascunho publicável com id/slug/section/tags dados. */
function draft(id: string, slug: string, sectionId: string, tagIds: string[]): Article {
	return Article.createDraft({
		id,
		headline: `Matéria ${id}`,
		slug,
		byline: { authorId: "a-1", name: "Ana" },
		kicker: "CHAPÉU",
		standfirst: "linha fina",
		sectionId,
		tagIds,
		body: [{ type: "paragraph", text: "Conteúdo." }],
		cover: { mediaId: "m-1", altText: "alt" },
	}).unwrap();
}

/** Leva o rascunho até PUBLICADA. */
function publish(article: Article): Article {
	article.submitForReview(NOW);
	article.approve();
	article.publish(NOW);
	return article;
}

function contract(label: string, make: () => Harness): void {
	describe(`ArticleRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("E05: salva e recupera por id e por slug, com todo o estado", async () => {
			await h.repo.save(publish(draft("art-1", "enchente", "cidades", ["chuva"])));

			const byId = await h.repo.findById("art-1");
			expect(byId?.status).toBe("PUBLICADA");
			expect(byId?.slug).toBe("enchente");
			expect(byId?.kicker).toBe("CHAPÉU");
			expect(byId?.sectionId).toBe("cidades");
			expect([...(byId?.tagIds ?? [])]).toEqual(["chuva"]);
			expect(byId?.cover?.mediaId).toBe("m-1");
			expect(byId?.body.blocks).toHaveLength(1);
			expect(byId?.publishedAt?.toISOString()).toBe(NOW.toISOString());
			// slug imutável sobrevive ao round-trip (firstPublishedAt persistido)
			expect(byId?.changeSlug("outro").isErr()).toBe(true);

			const bySlug = await h.repo.findBySlug("enchente");
			expect(bySlug?.id).toBe("art-1");
		});

		it("filtra a lista por status, editoria e busca", async () => {
			await h.repo.save(draft("d-1", "rascunho-a", "cidades", []));
			await h.repo.save(publish(draft("p-1", "publicada-b", "esportes", [])));

			expect(await h.repo.list({ status: "RASCUNHO" })).toHaveLength(1);
			expect(await h.repo.list({ sectionId: "esportes" })).toHaveLength(1);
			expect((await h.repo.list({ search: "Matéria p-1" }))[0]?.id).toBe("p-1");
		});

		it("E06: conta publicadas por editoria e por tag (base do ContentUsage)", async () => {
			await h.repo.save(draft("d-1", "rascunho", "cidades", ["chuva"])); // rascunho não conta
			await h.repo.save(publish(draft("p-1", "publicada", "cidades", ["chuva", "clima"])));

			expect(await h.repo.countPublishedInSection("cidades")).toBe(1);
			expect(await h.repo.countPublishedInSection("esportes")).toBe(0);
			expect(await h.repo.countPublishedWithTag("chuva")).toBe(1);
			expect(await h.repo.countPublishedWithTag("inexistente")).toBe(0);
		});

		it("exclui e some da busca", async () => {
			await h.repo.save(draft("art-1", "x", "cidades", []));
			await h.repo.delete("art-1");
			expect(await h.repo.findById("art-1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
			expect(await h.repo.findBySlug("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fakeHarness);
contract("prisma", prismaHarness);
