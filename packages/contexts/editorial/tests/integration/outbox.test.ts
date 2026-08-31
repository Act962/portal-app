import { newPrismaClient } from "@portal-app/db/client";
import { Article, InMemoryEventBus } from "@portal-app/editorial";
import { dispatchOutbox } from "@portal-app/editorial/infrastructure/outbox-relay";
import { PrismaArticleRepository } from "@portal-app/editorial/infrastructure/prisma-article-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));
const repo = new PrismaArticleRepository(prisma);

afterAll(async () => {
	await prisma.$disconnect();
});

beforeEach(async () => {
	await prisma.outboxEvent.deleteMany();
	await prisma.article.deleteMany();
});

const NOW = new Date("2026-08-05T12:00:00Z");

function publishedArticle(id: string, slug: string): Article {
	const article = Article.createDraft({
		id,
		headline: `Matéria ${id}`,
		slug,
		byline: { authorId: "a-1", name: "Ana" },
		sectionId: "cidades",
		body: [{ type: "paragraph", text: "corpo" }],
		cover: { mediaId: "m-1", altText: "alt" },
	}).unwrap();
	article.submitForReview(NOW);
	article.approve();
	article.publish(NOW);
	return article;
}

describe("Outbox transacional (ADR 0005)", () => {
	it("E07: grava o agregado e os eventos na mesma transação", async () => {
		// O agregado acumulou 2 eventos (submeter + publicar) antes do save.
		await repo.save(publishedArticle("art-1", "enchente"));

		const rows = await prisma.outboxEvent.findMany({
			where: { aggregateId: "art-1" },
		});
		const published = rows.find((r) => r.eventName === "ArticlePublished");
		expect(published).toBeDefined();
		expect((published?.payload as { slug: string }).slug).toBe("enchente");
		expect(await prisma.article.count()).toBe(1);
	});

	it("E07: rollback — falha ao persistir não deixa evento órfão", async () => {
		await repo.save(publishedArticle("art-1", "slug-unico"));
		const before = await prisma.outboxEvent.count();

		// Outro artigo com o MESMO slug viola a unique constraint: a transação
		// inteira (artigo + evento) deve reverter.
		await expect(
			repo.save(publishedArticle("art-2", "slug-unico")),
		).rejects.toThrow();

		expect(await prisma.outboxEvent.count()).toBe(before); // nenhum evento de art-2
		expect(
			await prisma.article.findUnique({ where: { id: "art-2" } }),
		).toBeNull();
	});

	/**
	 * Apagar é a única operação do editorial que destrói o que auditou. O evento
	 * precisa sair NA MESMA transação da remoção — senão a matéria sumiria do
	 * banco sem deixar registro de ter existido, e a auditoria passaria a ter um
	 * buraco exatamente no lugar em que ela mais serve.
	 */
	it("apagar grava o ArticleDeleted no outbox e some com a linha", async () => {
		const article = publishedArticle("art-1", "enchente");
		await repo.save(article);
		article.archive(NOW);
		await repo.save(article);

		article.markDeleted(NOW);
		await repo.delete(article);

		const deleted = await prisma.outboxEvent.findFirst({
			where: { aggregateId: "art-1", eventName: "ArticleDeleted" },
		});
		expect(deleted).not.toBeNull();
		// O título viaja no corpo: é o que sobra para a auditoria dizer O QUE foi
		// apagado, agora que a matéria não existe para ser consultada.
		expect((deleted?.payload as { headline: string }).headline).toBe(
			"Matéria art-1",
		);
		expect((deleted?.payload as { wasPublished: boolean }).wasPublished).toBe(
			true,
		);
		expect(
			await prisma.article.findUnique({ where: { id: "art-1" } }),
		).toBeNull();
	});

	it("apagar não apaga o histórico: os eventos anteriores continuam lá", async () => {
		const article = publishedArticle("art-1", "enchente");
		await repo.save(article);
		article.archive(NOW);
		await repo.save(article);
		article.markDeleted(NOW);
		await repo.delete(article);

		const names = (
			await prisma.outboxEvent.findMany({ where: { aggregateId: "art-1" } })
		).map((row) => row.eventName);
		expect(names).toContain("ArticlePublished");
		expect(names).toContain("ArticleUnpublished");
		expect(names).toContain("ArticleDeleted");
	});

	it("E08: despachar duas vezes não reentrega (idempotência)", async () => {
		await repo.save(publishedArticle("art-1", "enchente"));
		const bus = new InMemoryEventBus();

		const first = await dispatchOutbox(prisma, bus);
		expect(first).toBeGreaterThan(0);
		expect(await dispatchOutbox(prisma, bus)).toBe(0); // já processado
		expect(bus.delivered).toHaveLength(first); // não reentregou
		expect(
			bus.delivered.filter((r) => r.eventName === "ArticlePublished"),
		).toHaveLength(1);

		const row = await prisma.outboxEvent.findFirst({
			where: { aggregateId: "art-1" },
		});
		expect(row?.processedAt).not.toBeNull();
	});
});
