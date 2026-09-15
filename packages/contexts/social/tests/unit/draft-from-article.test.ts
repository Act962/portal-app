import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	draftPostForArticle,
	type PublishedArticle,
	SocialPostDrafted,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemorySocialPostRepository } from "./doubles";

const AGORA = new Date("2026-09-11T12:00:00Z");

const materia: PublishedArticle = {
	id: "art-1",
	headline: "Chuva forte alaga o centro de Piracuruca",
	standfirst: "Comércio fechou as portas na manhã desta quinta.",
	sectionName: "Cidades",
	authorName: "Maria Souza",
	tags: ["Piracuruca", "chuva"],
	url: "https://fm7cidades.com/cidades/chuva-alaga-centro",
	siteName: "Rádio 7 Cidades",
	coverMediaId: "media-capa",
};

let repo: InMemorySocialPostRepository;
let deps: Parameters<typeof draftPostForArticle>[1];

beforeEach(() => {
	repo = new InMemorySocialPostRepository();
	deps = {
		repo,
		clock: new FixedClock(AGORA),
		ids: new SequentialIdGenerator("post"),
		platforms: ["INSTAGRAM", "FACEBOOK"],
	};
});

describe("draftPostForArticle", () => {
	it("monta o rascunho com legenda, capa e link da matéria", async () => {
		const post = await draftPostForArticle(materia, deps);

		expect(post).not.toBeNull();
		expect(post?.status).toBe("RASCUNHO");
		expect(post?.origin).toBe("AUTOMATICA");
		expect(post?.articleId).toBe("art-1");
		expect(post?.mediaIds).toEqual(["media-capa"]);
		expect(post?.linkUrl).toBe(materia.url);
		expect(post?.targets).toEqual(["INSTAGRAM", "FACEBOOK"]);
	});

	it("a legenda sai do modelo, com título, linha-fina e hashtags", async () => {
		const post = await draftPostForArticle(materia, deps);
		const legenda = post?.caption.value ?? "";

		expect(legenda).toContain("Chuva forte alaga o centro de Piracuruca");
		expect(legenda).toContain("Comércio fechou as portas");
		expect(legenda).toContain("#Piracuruca #Chuva");
		// A URL NÃO entra: no Instagram ela não é clicável.
		expect(legenda).not.toContain("https://");
	});

	it("o Facebook recebe o link mesmo assim, acrescentado no envio", async () => {
		const post = await draftPostForArticle(materia, deps);
		expect(post?.captionFor("FACEBOOK")).toContain(materia.url);
		expect(post?.captionFor("INSTAGRAM")).not.toContain(materia.url);
	});

	it("aceita modelo próprio, para a tela de configuração poder trocá-lo", async () => {
		const post = await draftPostForArticle(materia, {
			...deps,
			template: "🚨 {titulo} — leia no {veiculo}",
		});
		expect(post?.caption.value).toBe(
			"🚨 Chuva forte alaga o centro de Piracuruca — leia no Rádio 7 Cidades",
		);
	});

	it("registra o evento, para a auditoria", async () => {
		const post = await draftPostForArticle(materia, deps);
		expect(post?.pullEvents()).toContainEventOfType(SocialPostDrafted);
	});

	describe("idempotência — o outbox entrega AO MENOS uma vez", () => {
		it("o segundo evento da mesma matéria não cria um segundo post", async () => {
			// O caminho real: matéria despublicada e republicada dispara
			// `ArticlePublished` de novo. Sem esta trava, a fila teria o mesmo post
			// duas vezes e alguém aprovaria os dois.
			await draftPostForArticle(materia, deps);
			const segundo = await draftPostForArticle(materia, deps);

			expect(segundo).toBeNull();
			expect(repo.posts.size).toBe(1);
		});

		it("post MANUAL sobre a mesma matéria não bloqueia o automático", async () => {
			// Republicar à mão uma matéria antiga é intenção, não duplicata.
			const { createDraft } = await import("@portal-app/social");
			const { staff } = await import("./doubles");
			await createDraft(
				staff("ADMIN"),
				{
					captionText: "Relembre",
					mediaIds: ["m-1"],
					platforms: ["INSTAGRAM"],
					articleId: "art-1",
				},
				deps,
			);

			const automatico = await draftPostForArticle(materia, deps);
			expect(automatico).not.toBeNull();
			expect(repo.posts.size).toBe(2);
		});
	});

	describe("matéria sem capa", () => {
		it("gera o rascunho ASSIM MESMO, sem imagem", async () => {
			// Pular em silêncio faria a notícia não existir na fila, e ninguém
			// procura o que não sabe que falta.
			const post = await draftPostForArticle(
				{ ...materia, coverMediaId: null },
				deps,
			);
			expect(post).not.toBeNull();
			expect(post?.mediaIds).toEqual([]);
		});

		it("e o impedimento aparece, para alguém escolher uma imagem", async () => {
			const post = await draftPostForArticle(
				{ ...materia, coverMediaId: null },
				deps,
			);
			expect(post?.publicationBlockers()).toContain(
				"A publicação precisa de ao menos uma imagem.",
			);
		});
	});

	it("legenda que sai vazia devolve null em vez de lançar", async () => {
		// Este código roda dentro do despacho do outbox: uma exceção aqui
		// travaria a entrega de TODOS os eventos seguintes, auditoria inclusive.
		// Melhor um post que não foi montado do que um relay parado.
		//
		// Com o modelo PADRÃO isso não acontece nem sem título — o texto fixo
		// ("Matéria completa no link da bio") sustenta a legenda sozinho. O caso
		// real é um modelo próprio feito só de campos, com a matéria sem eles.
		const post = await draftPostForArticle(
			{ ...materia, headline: "   " },
			{ ...deps, template: "{titulo}" },
		);
		expect(post).toBeNull();
		expect(repo.posts.size).toBe(0);
	});
});
