import {
	AltTextRequired,
	Article,
	ArticleDeleted,
	ArticleDiscarded,
	ArticleOnAir,
	ArticlePublished,
	ArticleRejected,
	ArticleScheduled,
	ArticleSubmittedForReview,
	ArticleUnpublished,
	ArticleUpdated,
	BodyRequired,
	CoverImageRequired,
	HeadlineRequired,
	InvalidTransition,
	RejectionReasonRequired,
	ScheduleInPast,
	SectionRequired,
	SlugImmutable,
} from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-08-05T12:00:00Z");
const LATER = new Date("2026-08-05T18:00:00Z");

function draft(overrides: Record<string, unknown> = {}): Article {
	return Article.createDraft({
		id: "art-1",
		headline: "Enchente atinge o centro",
		byline: { authorId: "a-1", name: "Ana" },
		...overrides,
	}).unwrap();
}

/** Rascunho já com tudo que a publicação exige. */
function publishable(): Article {
	return draft({
		sectionId: "cidades",
		body: [{ type: "paragraph", text: "Choveu muito." }],
		cover: { mediaId: "m-1", altText: "Rua alagada" },
	});
}

/** Rascunho publicável já levado até APROVADA. */
function approved(): Article {
	const article = publishable();
	article.submitForReview(NOW);
	article.approve();
	article.pullEvents(); // limpa os eventos do caminho até aqui
	return article;
}

describe("Article — criação", () => {
	it("nasce RASCUNHO com slug derivado do título", () => {
		const article = draft({ sectionId: "cidades", tagIds: ["chuva", "clima"] });
		expect(article.status).toBe("RASCUNHO");
		expect(article.headline).toBe("Enchente atinge o centro");
		expect(article.slug).toBe("enchente-atinge-o-centro");
		expect(article.sectionId).toBe("cidades");
		expect([...article.tagIds]).toEqual(["chuva", "clima"]);
		expect(article.byline.name).toBe("Ana");
		expect(article.isPublished()).toBe(false);
	});

	it("rejeita título, autor, slug ou bloco inválidos", () => {
		expect(
			Article.createDraft({
				id: "x",
				headline: " ",
				byline: { authorId: "a", name: "A" },
			}).unwrapErr(),
		).toBeInstanceOf(HeadlineRequired);
		expect(
			Article.createDraft({
				id: "x",
				headline: "T",
				slug: "!!!",
				byline: { authorId: "a", name: "A" },
			}).isErr(),
		).toBe(true);
		expect(
			Article.createDraft({
				id: "x",
				headline: "T",
				byline: { authorId: " ", name: " " },
			}).isErr(),
		).toBe(true);
		expect(
			Article.createDraft({
				id: "x",
				headline: "T",
				byline: { authorId: "a", name: "A" },
				body: [{ type: "paragraph", text: "" }],
			}).isErr(),
		).toBe(true);
	});
});

describe("Article — pendências de publicação (A04/E02)", () => {
	it("lista tudo que falta em um rascunho vazio", () => {
		const kinds = draft()
			.publishPreflight()
			.map((b) => b.name);
		expect(kinds).toEqual([
			"BodyRequired",
			"SectionRequired",
			"CoverImageRequired",
		]);
	});

	it("aponta alt-text faltando quando há capa sem alt", () => {
		const article = draft({
			sectionId: "cidades",
			body: [{ type: "paragraph", text: "x" }],
			cover: { mediaId: "m-1" },
		});
		expect(article.publishPreflight().map((b) => b.name)).toEqual([
			"AltTextRequired",
		]);
	});

	it("um rascunho publicável não tem pendências", () => {
		expect(publishable().publishPreflight()).toHaveLength(0);
	});
});

describe("Article — caminho feliz e eventos", () => {
	it("submete, aprova e publica, emitindo os eventos", () => {
		const article = publishable();

		expect(article.submitForReview(NOW).isOk()).toBe(true);
		expect(article.status).toBe("EM_REVISAO");
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleSubmittedForReview);

		expect(article.approve().isOk()).toBe(true);
		expect(article.status).toBe("APROVADA");

		expect(article.publish(NOW).isOk()).toBe(true);
		expect(article.status).toBe("PUBLICADA");
		expect(article.publishedAt?.toISOString()).toBe(NOW.toISOString());
		expect(article.firstPublishedAt?.toISOString()).toBe(NOW.toISOString());
		expect(article.isPublished()).toBe(true);

		const events = article.pullEvents();
		expect(events[0]).toBeInstanceOf(ArticlePublished);
		expect((events[0] as ArticlePublished).slug).toBe(
			"enchente-atinge-o-centro",
		);
		expect((events[0] as ArticlePublished).sectionId).toBe("cidades");
		expect(article.pullEvents()).toHaveLength(0); // esvaziou
	});
});

describe("Article — transições inválidas (E01)", () => {
	it("cada transição fora de ordem é rejeitada", () => {
		expect(draft().publish(NOW).unwrapErr()).toBeInstanceOf(InvalidTransition);
		expect(draft().approve().unwrapErr()).toBeInstanceOf(InvalidTransition);
		expect(draft().schedule(LATER, NOW).unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);
		expect(draft().cancelSchedule().unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);
		// `archive` saiu desta lista de propósito: arquivar um rascunho passou a
		// ser válido. A ÚNICA transição de arquivamento que continua proibida é
		// ARQUIVADA → ARQUIVADA, e ela está coberta em "Article — arquivar de
		// qualquer estado".
		expect(draft().markUpdated(NOW).unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);

		const inReview = publishable();
		inReview.submitForReview(NOW);
		expect(inReview.submitForReview(NOW).unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);
	});
});

describe("Article — publicação bloqueada por pendência (E02)", () => {
	it("publish devolve a pendência que falta", () => {
		const semCorpo = draft({
			sectionId: "c",
			cover: { mediaId: "m", altText: "a" },
		});
		semCorpo.submitForReview(NOW);
		semCorpo.approve();
		expect(semCorpo.publish(NOW).unwrapErr()).toBeInstanceOf(BodyRequired);

		const semEditoria = draft({
			body: [{ type: "paragraph", text: "x" }],
			cover: { mediaId: "m", altText: "a" },
		});
		semEditoria.submitForReview(NOW);
		semEditoria.approve();
		expect(semEditoria.publish(NOW).unwrapErr()).toBeInstanceOf(
			SectionRequired,
		);

		const semCapa = draft({
			sectionId: "c",
			body: [{ type: "paragraph", text: "x" }],
		});
		semCapa.submitForReview(NOW);
		semCapa.approve();
		expect(semCapa.publish(NOW).unwrapErr()).toBeInstanceOf(CoverImageRequired);

		const semAlt = draft({
			sectionId: "c",
			body: [{ type: "paragraph", text: "x" }],
			cover: { mediaId: "m" },
		});
		semAlt.submitForReview(NOW);
		semAlt.approve();
		expect(semAlt.publish(NOW).unwrapErr()).toBeInstanceOf(AltTextRequired);
	});
});

describe("Article — devolução com motivo (E04)", () => {
	it("devolve para RASCUNHO com motivo e evento", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.pullEvents();

		expect(article.reject("Faltam fontes", NOW).isOk()).toBe(true);
		expect(article.status).toBe("RASCUNHO");
		expect(article.rejectionReason).toBe("Faltam fontes");
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleRejected);
	});

	it("exige motivo e só devolve da revisão", () => {
		const inReview = publishable();
		inReview.submitForReview(NOW);
		expect(inReview.reject("  ", NOW).unwrapErr()).toBeInstanceOf(
			RejectionReasonRequired,
		);
		expect(draft().reject("x", NOW).unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);
	});

	it("aprovar limpa o motivo de devolução anterior", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.reject("revisar", NOW);
		article.submitForReview(NOW);
		article.approve();
		expect(article.rejectionReason).toBeNull();
	});
});

describe("Article — agendamento", () => {
	it("agenda para o futuro e publica a partir de AGENDADA", () => {
		const article = approved();

		expect(article.schedule(LATER, NOW).isOk()).toBe(true);
		expect(article.status).toBe("AGENDADA");
		expect(article.scheduledAt?.toISOString()).toBe(LATER.toISOString());
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleScheduled);

		expect(article.publish(LATER).isOk()).toBe(true);
		expect(article.status).toBe("PUBLICADA");
		expect(article.scheduledAt).toBeNull();
	});

	it("rejeita agendamento no passado", () => {
		expect(
			approved().schedule(new Date("2026-08-05T06:00:00Z"), NOW).unwrapErr(),
		).toBeInstanceOf(ScheduleInPast);
	});

	it("não agenda matéria com pendências", () => {
		const article = draft({
			sectionId: "c",
			cover: { mediaId: "m", altText: "a" },
		});
		article.submitForReview(NOW);
		article.approve();
		expect(article.schedule(LATER, NOW).unwrapErr()).toBeInstanceOf(
			BodyRequired,
		);
	});

	it("cancela o agendamento voltando para APROVADA", () => {
		const article = approved();
		article.schedule(LATER, NOW);
		expect(article.cancelSchedule().isOk()).toBe(true);
		expect(article.status).toBe("APROVADA");
		expect(article.scheduledAt).toBeNull();
	});
});

describe("Article — slug imutável após publicar (E03)", () => {
	it("permite trocar antes, proíbe depois da primeira publicação", () => {
		const article = publishable();
		expect(article.changeSlug("novo-slug").isOk()).toBe(true);
		expect(article.slug).toBe("novo-slug");
		expect(article.changeSlug("!!!").unwrapErr().name).toBe("InvalidSlug");

		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);

		expect(article.changeSlug("outro").unwrapErr()).toBeInstanceOf(
			SlugImmutable,
		);
	});
});

describe("Article — atualização e arquivamento", () => {
	it("editar publicada vira ATUALIZADA; arquivar encerra", () => {
		const article = approved();
		article.publish(NOW);
		article.pullEvents();

		expect(article.markUpdated(NOW).isOk()).toBe(true);
		expect(article.status).toBe("ATUALIZADA");
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleUpdated);

		expect(article.archive(NOW).isOk()).toBe(true);
		expect(article.status).toBe("ARQUIVADA");
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleUnpublished);
	});
});

describe("Article — edição de conteúdo", () => {
	it("edita só os campos informados e valida", () => {
		const article = draft();
		const result = article.editContent({
			headline: "  Novo título ",
			kicker: "URGENTE",
			standfirst: "apoio",
			sectionId: "cidades",
			tagIds: ["t1"],
			body: [{ type: "paragraph", text: "novo corpo" }],
			cover: { mediaId: "m-9", altText: "capa" },
			authorName: "Bruno",
		});

		expect(result.isOk()).toBe(true);
		expect(article.headline).toBe("Novo título");
		expect(article.kicker).toBe("URGENTE");
		expect(article.sectionId).toBe("cidades");
		expect([...article.tagIds]).toEqual(["t1"]);
		expect(article.cover?.mediaId).toBe("m-9");
		expect(article.byline.name).toBe("Bruno");
		expect(article.slug).toBe("enchente-atinge-o-centro"); // slug intacto
	});

	it("limpa capa com null e mantém edição parcial", () => {
		const article = draft({ cover: { mediaId: "m-1", altText: "a" } });
		article.editContent({ cover: null });
		expect(article.cover).toBeNull();
	});

	it("valida título, corpo e autor na edição", () => {
		const article = draft();
		expect(article.editContent({ headline: " " }).unwrapErr()).toBeInstanceOf(
			HeadlineRequired,
		);
		expect(
			article.editContent({ body: [{ type: "paragraph", text: "" }] }).isErr(),
		).toBe(true);
		expect(article.editContent({ authorName: " " }).isErr()).toBe(true);
	});

	it("não edita matéria arquivada", () => {
		const article = approved();
		article.publish(NOW);
		article.archive(NOW);
		expect(article.editContent({ headline: "x" }).unwrapErr()).toBeInstanceOf(
			InvalidTransition,
		);
	});
});

describe("Article — reidratação", () => {
	it("restaura um agendado e um publicado", () => {
		const scheduled = Article.restore({
			id: "art-1",
			headline: "T",
			slug: "t",
			byline: { authorId: "a", name: "A" },
			kicker: "CHAPÉU",
			standfirst: "linha",
			sectionId: "cidades",
			body: [{ type: "paragraph", text: "x" }],
			cover: { mediaId: "m", altText: "alt" },
			status: "AGENDADA",
			scheduledAt: LATER,
		});
		expect(scheduled.status).toBe("AGENDADA");
		expect(scheduled.scheduledAt?.toISOString()).toBe(LATER.toISOString());
		expect(scheduled.kicker).toBe("CHAPÉU");
		expect(scheduled.standfirst).toBe("linha");
		expect(scheduled.cover?.mediaId).toBe("m");
		expect(scheduled.body.blocks).toHaveLength(1);

		const published = Article.restore({
			id: "art-2",
			headline: "T2",
			slug: "t2",
			byline: { authorId: "a", name: "A" },
			status: "PUBLICADA",
			publishedAt: NOW,
			firstPublishedAt: NOW,
		});
		expect(published.isPublished()).toBe(true);
		// slug imutável porque já foi publicado
		expect(published.changeSlug("z").unwrapErr()).toBeInstanceOf(SlugImmutable);
	});

	it("estoura ao restaurar dados inválidos", () => {
		expect(() =>
			Article.restore({
				id: "x",
				headline: "",
				slug: "t",
				byline: { authorId: "a", name: "A" },
				status: "RASCUNHO",
			}),
		).toThrow();
	});
});

/**
 * Arquivar deixou de ser exclusividade do que está no ar. A regra nova é uma
 * só — de qualquer estado, menos do próprio arquivo —, mas ela tem duas bordas
 * que só aparecem em teste: o EVENTO muda conforme a matéria já tenha ido ao
 * público ou não, e a AGENDADA precisa perder a hora marcada ao ser arquivada.
 */
describe("Article — arquivar de qualquer estado", () => {
	it("arquiva o rascunho abandonado, sem passar pelo fluxo", () => {
		const article = draft();
		expect(article.archive(NOW).isOk()).toBe(true);
		expect(article.status).toBe("ARQUIVADA");
	});

	it("rascunho arquivado emite ArticleDiscarded, não ArticleUnpublished", () => {
		// A distinção não é cosmética: quem reage a "despublicada" vai ter de
		// revalidar home, editoria e sitemap. Descartar rascunho não tira nada
		// da web, porque nada estava lá.
		const article = draft();
		article.archive(NOW);
		const [event] = article.pullEvents();
		expect(event).toBeInstanceOf(ArticleDiscarded);
		expect(event).not.toBeInstanceOf(ArticleUnpublished);
	});

	it("publicada arquivada continua emitindo ArticleUnpublished", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);
		article.pullEvents();

		article.archive(LATER);
		expect(article.pullEvents()[0]).toBeInstanceOf(ArticleUnpublished);
	});

	it("arquivar a AGENDADA cancela o agendamento junto", () => {
		// Sem isto sobraria no banco uma matéria arquivada com hora marcada para
		// ir ao ar — um estado que não quer dizer nada.
		const article = publishable();
		article.submitForReview(NOW);
		article.approve();
		article.schedule(LATER, NOW);
		expect(article.scheduledAt).not.toBeNull();

		article.archive(NOW);
		expect(article.status).toBe("ARQUIVADA");
		expect(article.scheduledAt).toBeNull();
	});

	it("de EM_REVISAO e de APROVADA também sai", () => {
		const emRevisao = publishable();
		emRevisao.submitForReview(NOW);
		expect(emRevisao.archive(NOW).isOk()).toBe(true);

		const aprovada = publishable();
		aprovada.submitForReview(NOW);
		aprovada.approve();
		expect(aprovada.archive(NOW).isOk()).toBe(true);
	});

	it("já arquivada não se arquiva de novo", () => {
		const article = draft();
		article.archive(NOW);
		const again = article.archive(NOW);
		expect(again.unwrapErr()).toBeInstanceOf(InvalidTransition);
	});
});

describe("Article — apagar", () => {
	it("recusa apagar o que está NO AR", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);

		expect(article.markDeleted(NOW).unwrapErr()).toBeInstanceOf(ArticleOnAir);
	});

	it("recusa também a ATUALIZADA", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);
		article.markUpdated(LATER);

		expect(article.markDeleted(LATER).unwrapErr()).toBeInstanceOf(ArticleOnAir);
	});

	it("aceita rascunho, revisão, aprovada, agendada e arquivada", () => {
		const rascunho = draft();
		expect(rascunho.markDeleted(NOW).isOk()).toBe(true);

		const emRevisao = publishable();
		emRevisao.submitForReview(NOW);
		expect(emRevisao.markDeleted(NOW).isOk()).toBe(true);

		const aprovada = publishable();
		aprovada.submitForReview(NOW);
		aprovada.approve();
		expect(aprovada.markDeleted(NOW).isOk()).toBe(true);

		const agendada = publishable();
		agendada.submitForReview(NOW);
		agendada.approve();
		agendada.schedule(LATER, NOW);
		expect(agendada.markDeleted(NOW).isOk()).toBe(true);

		const arquivada = draft();
		arquivada.archive(NOW);
		expect(arquivada.markDeleted(NOW).isOk()).toBe(true);
	});

	it("o evento carrega título e endereço — é o que sobra da matéria", () => {
		// Depois do apagamento a linha da auditoria é o ÚNICO registro de que
		// aquilo existiu, e "art-1 foi apagada" não presta contas de nada.
		const article = draft({ headline: "Enchente atinge o centro" });
		article.markDeleted(NOW);

		const [event] = article.pullEvents();
		expect(event).toBeInstanceOf(ArticleDeleted);
		const deleted = event as ArticleDeleted;
		expect(deleted.headline).toBe("Enchente atinge o centro");
		expect(deleted.slug).toBe("enchente-atinge-o-centro");
		expect(deleted.wasPublished).toBe(false);
	});

	it("marca wasPublished quando a matéria já esteve no ar", () => {
		const article = publishable();
		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);
		article.archive(LATER);
		article.pullEvents();

		article.markDeleted(LATER);
		expect((article.pullEvents()[0] as ArticleDeleted).wasPublished).toBe(true);
	});

	it("wasEverPublished não é o mesmo que estar publicada agora", () => {
		const article = publishable();
		expect(article.wasEverPublished()).toBe(false);

		article.submitForReview(NOW);
		article.approve();
		article.publish(NOW);
		article.archive(LATER);

		expect(article.isPublished()).toBe(false);
		expect(article.wasEverPublished()).toBe(true);
	});
});
