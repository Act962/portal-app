import {
	Caption,
	Delivery,
	type SocialPlatform,
	SocialPost,
	SocialPostApproved,
	SocialPostDrafted,
	SocialPostFailed,
	SocialPostPublished,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const CRIADO = new Date("2026-09-11T12:00:00Z");
const AGORA = new Date("2026-09-11T12:05:00Z");

function rascunho(
	overrides: Partial<{
		captionText: string;
		mediaIds: readonly string[];
		platforms: readonly SocialPlatform[];
		articleId: string | null;
	}> = {},
) {
	return SocialPost.draft({
		id: "post-1",
		articleId: "articleId" in overrides ? overrides.articleId : "art-1",
		origin: "AUTOMATICA",
		captionText: overrides.captionText ?? "Chuva alaga o centro #Piracuruca",
		mediaIds: overrides.mediaIds ?? ["media-1"],
		linkUrl: "https://fm7cidades.com/cidades/chuva",
		platforms: overrides.platforms ?? ["INSTAGRAM", "FACEBOOK"],
		createdAt: CRIADO,
	}).unwrap();
}

describe("draft", () => {
	it("nasce RASCUNHO mesmo vindo de matéria publicada (D1)", () => {
		// A decisão do cliente: ninguém é surpreendido por um post que não leu.
		const post = rascunho();
		expect(post.status).toBe("RASCUNHO");
		expect(post.approvedAt).toBeNull();
	});

	it("abre uma entrega PENDENTE por rede escolhida", () => {
		const post = rascunho();
		expect(post.targets).toEqual(["INSTAGRAM", "FACEBOOK"]);
		expect(post.pendingDeliveries()).toHaveLength(2);
		expect(post.deliveryFor("INSTAGRAM")?.remoteId).toBeNull();
	});

	it("escolher a mesma rede duas vezes não vira dois envios", () => {
		const post = rascunho({ platforms: ["INSTAGRAM", "INSTAGRAM"] });
		expect(post.targets).toEqual(["INSTAGRAM"]);
	});

	it("registra o evento de rascunho, para a auditoria", () => {
		expect(rascunho().pullEvents()).toContainEventOfType(SocialPostDrafted);
	});

	it("uma imagem é foto; duas ou mais, carrossel", () => {
		expect(rascunho({ mediaIds: ["m-1"] }).isCarousel).toBe(false);
		expect(rascunho({ mediaIds: ["m-1", "m-2"] }).isCarousel).toBe(true);
	});

	it("recusa legenda vazia", () => {
		const erro = SocialPost.draft({
			id: "p",
			origin: "MANUAL",
			captionText: "  ",
			mediaIds: ["m-1"],
			platforms: ["INSTAGRAM"],
			createdAt: CRIADO,
		}).unwrapErr();
		expect(erro.name).toBe("CaptionRequired");
	});

	it("recusa a mesma imagem duas vezes — é erro de clique, não intenção", () => {
		const erro = SocialPost.draft({
			id: "p",
			origin: "MANUAL",
			captionText: "oi",
			mediaIds: ["m-1", "m-1"],
			platforms: ["INSTAGRAM"],
			createdAt: CRIADO,
		}).unwrapErr();
		expect(erro.name).toBe("InvalidMediaSelection");
		expect(erro.message).toContain("duas vezes");
	});

	it("recusa mais de 10 imagens", () => {
		const onze = Array.from({ length: 11 }, (_, index) => `m-${index}`);
		expect(
			SocialPost.draft({
				id: "p",
				origin: "MANUAL",
				captionText: "oi",
				mediaIds: onze,
				platforms: ["INSTAGRAM"],
				createdAt: CRIADO,
			}).unwrapErr().name,
		).toBe("InvalidMediaSelection");
	});

	it("ignora id vazio na lista de imagens", () => {
		const post = rascunho({ mediaIds: ["m-1", "  ", ""] });
		expect(post.mediaIds).toEqual(["m-1"]);
	});

	it("post avulso não tem matéria", () => {
		expect(rascunho({ articleId: null }).articleId).toBeNull();
	});
});

describe("captionFor — uma legenda aprovada, o link só onde ele funciona", () => {
	it("o Instagram recebe a legenda crua", () => {
		expect(rascunho().captionFor("INSTAGRAM")).toBe(
			"Chuva alaga o centro #Piracuruca",
		);
	});

	it("o Facebook recebe a legenda com o link", () => {
		expect(rascunho().captionFor("FACEBOOK")).toBe(
			"Chuva alaga o centro #Piracuruca\n\nhttps://fm7cidades.com/cidades/chuva",
		);
	});

	it("não repete o link que a pessoa já escreveu na legenda", () => {
		const post = rascunho({
			captionText: "Leia em https://fm7cidades.com/cidades/chuva agora",
		});
		expect(post.captionFor("FACEBOOK")).toBe(
			"Leia em https://fm7cidades.com/cidades/chuva agora",
		);
	});

	it("post sem link sai igual nas duas redes", () => {
		const post = rascunho();
		post.edit({ linkUrl: null });
		expect(post.captionFor("FACEBOOK")).toBe(post.captionFor("INSTAGRAM"));
	});
});

describe("publicationBlockers — dizer o que falta ANTES do clique", () => {
	it("post pronto não tem impedimento", () => {
		expect(rascunho().publicationBlockers()).toEqual([]);
	});

	it("sem rede escolhida, avisa", () => {
		const post = rascunho({ platforms: [] });
		expect(post.publicationBlockers()).toContain(
			"Escolha ao menos uma rede social.",
		);
	});

	it("sem imagem, avisa", () => {
		const post = rascunho({ mediaIds: [] });
		expect(post.publicationBlockers()).toContain(
			"A publicação precisa de ao menos uma imagem.",
		);
	});

	it("legenda longa demais diz o tamanho e o limite daquela rede", () => {
		const post = rascunho({
			captionText: "a".repeat(2201),
			platforms: ["INSTAGRAM"],
		});
		const [impedimento] = post.publicationBlockers();
		expect(impedimento).toContain("2201");
		expect(impedimento).toContain("Instagram");
		expect(impedimento).toContain("2200");
	});

	it("a mesma legenda não impede nada no Facebook", () => {
		const post = rascunho({
			captionText: "a".repeat(2201),
			platforms: ["FACEBOOK"],
		});
		expect(post.publicationBlockers()).toEqual([]);
	});

	it("imagem demais barra a rede, mesmo em post que entrou por outro caminho", () => {
		// Via `draft` isto é inalcançável (ele já recusa acima de 10). A régua
		// existe para o post RESTAURADO: dado gravado antes de um limite mudar, ou
		// vindo de migração, chega por `restore` sem passar por validação nenhuma.
		const post = SocialPost.restore({
			id: "antigo",
			articleId: null,
			origin: "MANUAL",
			caption: Caption.restore("Retrospectiva do ano"),
			mediaIds: Array.from({ length: 11 }, (_, index) => `m-${index}`),
			linkUrl: null,
			deliveries: [Delivery.pending("INSTAGRAM")],
			status: "RASCUNHO",
			createdAt: CRIADO,
			approvedAt: null,
			approvedByStaffId: null,
		});
		expect(post.publicationBlockers()[0]).toContain("11 imagens");
		expect(post.approve("staff-1", AGORA).unwrapErr().name).toBe(
			"PostNotReady",
		);
	});

	it("hashtag demais barra o Instagram", () => {
		const post = rascunho({
			captionText: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "),
			platforms: ["INSTAGRAM"],
		});
		expect(post.publicationBlockers()[0]).toContain("hashtags");
	});
});

describe("edit", () => {
	it("troca legenda, imagens e redes do rascunho", () => {
		const post = rascunho();
		expect(
			post
				.edit({
					captionText: "Outra legenda",
					mediaIds: ["m-9", "m-8"],
					platforms: ["FACEBOOK"],
					linkUrl: null,
				})
				.isOk(),
		).toBe(true);
		expect(post.caption.value).toBe("Outra legenda");
		// A ordem é preservada: no carrossel, a primeira imagem é a capa do feed.
		expect(post.mediaIds).toEqual(["m-9", "m-8"]);
		expect(post.targets).toEqual(["FACEBOOK"]);
		expect(post.linkUrl).toBeNull();
	});

	it("recusa editar depois de aprovado — o texto está congelado", () => {
		// Editar o que já está no Facebook criaria duas verdades sobre o que o
		// veículo disse, e a auditoria deixaria de servir para alguma coisa.
		const post = rascunho();
		post.approve("staff-1", AGORA);
		const erro = post.edit({ captionText: "tarde demais" }).unwrapErr();
		expect(erro.name).toBe("InvalidPostTransition");
		expect(erro.message).toContain("PUBLICANDO");
	});

	it("propaga o erro de legenda vazia e de imagem repetida", () => {
		const post = rascunho();
		expect(post.edit({ captionText: " " }).unwrapErr().name).toBe(
			"CaptionRequired",
		);
		expect(post.edit({ mediaIds: ["x", "x"] }).unwrapErr().name).toBe(
			"InvalidMediaSelection",
		);
	});
});

describe("approve — o cadeado contra o post duplicado", () => {
	it("tranca o post e registra quem aprovou", () => {
		const post = rascunho();
		expect(post.approve("staff-1", AGORA).isOk()).toBe(true);
		expect(post.status).toBe("PUBLICANDO");
		expect(post.approvedByStaffId).toBe("staff-1");
		expect(post.approvedAt).toEqual(AGORA);
		expect(post.pullEvents()).toContainEventOfType(SocialPostApproved);
	});

	it("RECUSA a segunda aprovação — é o segundo clique, ou a segunda aba", () => {
		// Sem isto, dois cliques no botão viram dois posts no Instagram, e o
		// Instagram não tem desfazer.
		const post = rascunho();
		post.approve("staff-1", AGORA);
		const erro = post.approve("staff-1", AGORA).unwrapErr();
		expect(erro.name).toBe("InvalidPostTransition");
	});

	it("recusa com a lista do que falta, não com um 'não foi possível'", () => {
		const post = rascunho({ mediaIds: [], platforms: [] });
		const erro = post.approve("staff-1", AGORA).unwrapErr();
		expect(erro.name).toBe("PostNotReady");
		expect(erro).toHaveProperty("blockers");
		expect((erro as { blockers: string[] }).blockers).toHaveLength(2);
		expect(post.status).toBe("RASCUNHO");
	});
});

describe("resultado das entregas", () => {
	function aprovado() {
		const post = rascunho();
		post.approve("staff-1", AGORA);
		post.pullEvents();
		return post;
	}

	it("todas aceitaram → PUBLICADO", () => {
		const post = aprovado();
		post.recordSuccess("INSTAGRAM", "ig-1", "https://instagr.am/p/1", AGORA);
		expect(post.status).toBe("PUBLICANDO"); // ainda falta o Facebook
		post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		expect(post.status).toBe("PUBLICADO");
		expect(post.deliveryFor("INSTAGRAM")?.permalink).toBe(
			"https://instagr.am/p/1",
		);
	});

	it("uma aceitou e outra não → PARCIAL, o estado que quase todo mundo esquece", () => {
		const post = aprovado();
		post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		post.recordFailure("INSTAGRAM", "A imagem não é JPEG.", AGORA);
		expect(post.status).toBe("PARCIAL");
		expect(post.deliveryFor("INSTAGRAM")?.error).toBe("A imagem não é JPEG.");
	});

	it("nenhuma aceitou → FALHOU", () => {
		const post = aprovado();
		post.recordFailure("INSTAGRAM", "cota esgotada", AGORA);
		post.recordFailure("FACEBOOK", "token expirado", AGORA);
		expect(post.status).toBe("FALHOU");
	});

	it("registra um evento por entrega, para a auditoria", () => {
		const post = aprovado();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		post.recordFailure("FACEBOOK", "deu ruim", AGORA);
		const eventos = post.pullEvents();
		expect(eventos).toContainEventOfType(SocialPostPublished);
		expect(eventos).toContainEventOfType(SocialPostFailed);
	});

	it("entrega já publicada NUNCA muda de remoteId", () => {
		// O caminho real: a chamada deu certo, a resposta se perdeu na volta, e o
		// reenvio criou um segundo post lá. Sobrescrever perderia o id do
		// primeiro — e com ele a única chance de apagar a duplicata.
		const post = aprovado();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		post.recordSuccess("INSTAGRAM", "ig-2", null, AGORA);
		post.recordFailure("INSTAGRAM", "erro tardio", AGORA);
		expect(post.deliveryFor("INSTAGRAM")?.remoteId).toBe("ig-1");
		expect(post.deliveryFor("INSTAGRAM")?.error).toBeNull();
	});

	it("resultado de rede que não é alvo deste post é ignorado", () => {
		const post = rascunho({ platforms: ["INSTAGRAM"] });
		post.approve("staff-1", AGORA);
		post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		expect(post.status).toBe("PUBLICANDO");
		expect(post.deliveryFor("FACEBOOK")).toBeUndefined();
	});

	it("conta as tentativas, para a tela parar de oferecer 'tentar de novo'", () => {
		const post = aprovado();
		post.recordFailure("INSTAGRAM", "erro 1", AGORA);
		post.retryFailed();
		post.recordFailure("INSTAGRAM", "erro 2", AGORA);
		expect(post.deliveryFor("INSTAGRAM")?.attempts).toBe(2);
		expect(post.deliveryFor("INSTAGRAM")?.lastAttemptAt).toEqual(AGORA);
	});
});

describe("retryFailed — reenvia só o que falhou", () => {
	function parcial() {
		const post = rascunho();
		post.approve("staff-1", AGORA);
		post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		post.recordFailure("INSTAGRAM", "imagem inválida", AGORA);
		post.pullEvents();
		return post;
	}

	it("devolve à fila apenas a entrega que falhou", () => {
		// É a razão de a entrega ser uma entidade própria: reenviar o post
		// inteiro publicaria no Facebook uma segunda vez.
		const post = parcial();
		expect(post.retryFailed().isOk()).toBe(true);
		expect(post.status).toBe("PUBLICANDO");
		expect(post.pendingDeliveries().map((d) => d.platform)).toEqual([
			"INSTAGRAM",
		]);
		expect(post.deliveryFor("FACEBOOK")?.remoteId).toBe("fb-1");
	});

	it("limpa a mensagem de erro ao reenfileirar", () => {
		const post = parcial();
		post.retryFailed();
		expect(post.deliveryFor("INSTAGRAM")?.error).toBeNull();
	});

	it("recusa em rascunho e em post já concluído", () => {
		expect(rascunho().retryFailed().unwrapErr().name).toBe(
			"InvalidPostTransition",
		);
		const post = parcial();
		post.retryFailed();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		expect(post.status).toBe("PUBLICADO");
		expect(post.retryFailed().isErr()).toBe(true);
	});
});

describe("cancel", () => {
	it("descarta o rascunho", () => {
		const post = rascunho();
		expect(post.cancel().isOk()).toBe(true);
		expect(post.status).toBe("CANCELADA");
	});

	it("recusa cancelar o que já foi aprovado — a Meta não desfaz por nós", () => {
		const post = rascunho();
		post.approve("staff-1", AGORA);
		expect(post.cancel().unwrapErr().name).toBe("InvalidPostTransition");
	});
});

describe("restore", () => {
	it("devolve o post do banco sem revalidar nem reemitir evento", () => {
		const original = rascunho();
		original.pullEvents();
		const restaurado = SocialPost.restore({
			id: original.id,
			articleId: original.articleId,
			origin: original.origin,
			caption: original.caption,
			mediaIds: original.mediaIds,
			linkUrl: original.linkUrl,
			deliveries: [...original.deliveries],
			status: "PARCIAL",
			createdAt: original.createdAt,
			approvedAt: AGORA,
			approvedByStaffId: "staff-9",
		});
		expect(restaurado.status).toBe("PARCIAL");
		expect(restaurado.approvedByStaffId).toBe("staff-9");
		expect(restaurado.pullEvents()).toHaveLength(0);
	});
});
