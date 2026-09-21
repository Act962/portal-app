import {
	ArtTemplate,
	Caption,
	contentWithHeadline,
	Delivery,
	type DeliveryModes,
	InvalidDeliveryTransition,
	MAX_AUTOMATIC_ATTEMPTS,
	SocialDeliveryDismissed,
	type SocialPlatform,
	SocialPost,
	SocialPostApproved,
	SocialPostDrafted,
	SocialPostFailed,
	SocialPostPublished,
	selectionFrom,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import { CONTEUDO, design, tituloEditavel } from "./art-fixtures";

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

	it("conta as tentativas do CICLO — o 'tentar de novo' abre um ciclo novo", () => {
		const post = aprovado();
		post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		post.recordFailure("INSTAGRAM", "erro 1", AGORA);
		expect(post.deliveryFor("INSTAGRAM")?.attempts).toBe(1);
		expect(post.retryFailed().isOk()).toBe(true);
		post.recordFailure("INSTAGRAM", "erro 2", AGORA);
		// Zerado no requeue: sem isso, a entrega que já esgotou as tentativas
		// automáticas desistiria na primeira instabilidade depois do clique.
		expect(post.deliveryFor("INSTAGRAM")?.attempts).toBe(1);
		expect(post.deliveryFor("INSTAGRAM")?.lastAttemptAt).toEqual(AGORA);
	});

	describe("falha passageira (retryable)", () => {
		it("fica na fila com o motivo visível, e sem evento de falha", () => {
			const post = aprovado();
			post.recordFailure("INSTAGRAM", "O Instagram está instável.", AGORA, {
				retryable: true,
			});

			const entrega = post.deliveryFor("INSTAGRAM");
			expect(entrega?.isPending()).toBe(true);
			expect(entrega?.error).toBe(
				"O Instagram está instável. Nova tentativa automática em alguns minutos.",
			);
			expect(entrega?.attempts).toBe(1);
			expect(post.status).toBe("PUBLICANDO");
			// A auditoria registra o que deixou de ir ao ar, não cada soluço da rede.
			expect(
				post.pullEvents().some((event) => event instanceof SocialPostFailed),
			).toBe(false);
		});

		it("desiste na última tentativa automática e diz o que fazer", () => {
			const post = aprovado();
			for (let attempt = 0; attempt < MAX_AUTOMATIC_ATTEMPTS; attempt += 1) {
				post.recordFailure("INSTAGRAM", "Instável.", AGORA, {
					retryable: true,
				});
			}

			const entrega = post.deliveryFor("INSTAGRAM");
			expect(entrega?.isFailed()).toBe(true);
			expect(entrega?.attempts).toBe(MAX_AUTOMATIC_ATTEMPTS);
			expect(entrega?.error).toContain("Tentar de novo");
			// Nenhuma promessa de nova tentativa na mensagem final.
			expect(entrega?.error).not.toContain("Nova tentativa automática");
			expect(post.pullEvents()).toContainEventOfType(SocialPostFailed);
		});

		it("falha definitiva não espera: FALHOU na primeira, com a frase original", () => {
			const post = aprovado();
			post.recordFailure("INSTAGRAM", "A imagem é grande demais.", AGORA, {
				retryable: false,
			});
			expect(post.deliveryFor("INSTAGRAM")?.isFailed()).toBe(true);
			expect(post.deliveryFor("INSTAGRAM")?.error).toBe(
				"A imagem é grande demais.",
			);
		});

		it("passageira depois de publicada é ignorada", () => {
			const post = aprovado();
			post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
			post.recordFailure("INSTAGRAM", "Instável.", AGORA, { retryable: true });
			expect(post.deliveryFor("INSTAGRAM")?.isPublished()).toBe(true);
			expect(post.deliveryFor("INSTAGRAM")?.error).toBeNull();
		});

		it("o 'tentar de novo' devolve três tentativas automáticas novas", () => {
			const post = aprovado();
			post.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
			for (let attempt = 0; attempt < MAX_AUTOMATIC_ATTEMPTS; attempt += 1) {
				post.recordFailure("INSTAGRAM", "Instável.", AGORA, {
					retryable: true,
				});
			}
			expect(post.status).toBe("PARCIAL");

			post.retryFailed();
			post.recordFailure("INSTAGRAM", "Instável.", AGORA, { retryable: true });

			expect(post.deliveryFor("INSTAGRAM")?.isPending()).toBe(true);
			expect(post.status).toBe("PUBLICANDO");
		});
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
		expect(post.pendingDeliveries().map((d) => d.destination)).toEqual([
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

describe("Stories do Instagram (§17)", () => {
	it("não levam legenda", () => {
		const post = rascunho({ platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"] });
		expect(post.captionFor("INSTAGRAM_STORIES")).toBe("");
		expect(post.captionFor("INSTAGRAM")).not.toBe("");
	});

	it("usam só a primeira imagem; o feed do mesmo post usa todas", () => {
		const post = rascunho({
			mediaIds: ["m-1", "m-2", "m-3"],
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
		});
		expect(post.imagesFor("INSTAGRAM_STORIES")).toEqual(["m-1"]);
		expect(post.imagesFor("INSTAGRAM")).toEqual(["m-1", "m-2", "m-3"]);
	});

	it("legenda longa e hashtags demais não barram os Stories, que não a publicam", () => {
		const post = rascunho({
			captionText: `${"a".repeat(2201)} ${Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")}`,
			platforms: ["INSTAGRAM_STORIES"],
		});
		expect(post.publicationBlockers()).toEqual([]);
	});

	it("mas continuam barrando o feed do mesmo post", () => {
		const post = rascunho({
			captionText: "a".repeat(2201),
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
		});
		const impedimentos = post.publicationBlockers();
		expect(impedimentos).toHaveLength(1);
		expect(impedimentos[0]).toContain("Instagram aceita 2200");
	});

	it("carrossel acima do limite não barra o story, que usa uma imagem só", () => {
		const post = SocialPost.restore({
			id: "antigo",
			articleId: null,
			origin: "MANUAL",
			caption: Caption.restore("Retrospectiva"),
			mediaIds: Array.from({ length: 11 }, (_, index) => `m-${index}`),
			linkUrl: null,
			deliveries: [Delivery.pending("INSTAGRAM_STORIES")],
			status: "RASCUNHO",
			createdAt: CRIADO,
			approvedAt: null,
			approvedByStaffId: null,
		});
		expect(post.publicationBlockers()).toEqual([]);
	});

	it("sem imagem, o story também avisa", () => {
		const post = rascunho({ mediaIds: [], platforms: ["INSTAGRAM_STORIES"] });
		expect(post.publicationBlockers()).toContain(
			"A publicação precisa de ao menos uma imagem.",
		);
	});

	it("feed e story são entregas separadas: um no ar, o outro reenviado sozinho", () => {
		const post = rascunho({ platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"] });
		post.approve("staff-1", AGORA);
		post.recordSuccess("INSTAGRAM", "ig-feed", null, AGORA);
		post.recordFailure("INSTAGRAM_STORIES", "imagem recusada", AGORA);
		expect(post.status).toBe("PARCIAL");

		const eventos = post.pullEvents();
		expect(
			eventos
				.filter((evento) => evento instanceof SocialPostFailed)
				.map((evento) => (evento as SocialPostFailed).platform),
		).toEqual(["INSTAGRAM_STORIES"]);

		post.retryFailed();
		expect(post.pendingDeliveries().map((d) => d.destination)).toEqual([
			"INSTAGRAM_STORIES",
		]);
		expect(post.deliveryFor("INSTAGRAM")?.remoteId).toBe("ig-feed");
	});
});

describe("arte por destino (spec 09, F5)", () => {
	const titulo = tituloEditavel();
	const padrao = (format: "4:5" | "9:16", name = "Últimas") =>
		ArtTemplate.create({
			id: `tpl-${format}`,
			name,
			format,
			design: design([titulo]),
			createdAt: CRIADO,
		}).unwrap();
	const feed = selectionFrom(padrao("4:5"));
	const stories = selectionFrom(padrao("9:16", "Stories"));
	const conteudo = CONTEUDO;

	function comArte() {
		return SocialPost.draft({
			id: "post-arte",
			origin: "AUTOMATICA",
			articleId: "art-9",
			captionText: "Chuva",
			mediaIds: ["m-1"],
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			art: { INSTAGRAM: feed, INSTAGRAM_STORIES: stories },
			artContent: conteudo,
			createdAt: CRIADO,
		}).unwrap();
	}

	it("o rascunho guarda a arte de cada destino e o conteúdo das caixas", () => {
		const post = comArte();
		expect(post.artFor("INSTAGRAM")?.templateId).toBe("tpl-4:5");
		expect(post.artFor("INSTAGRAM_STORIES")?.format).toBe("9:16");
		expect(post.artFor("FACEBOOK")).toBeNull();
		expect(post.artContent).toEqual(conteudo);
	});

	it("o rascunho descarta arte de destino que o post não tem ou que não serve", () => {
		const post = SocialPost.draft({
			id: "p",
			origin: "AUTOMATICA",
			captionText: "Chuva",
			mediaIds: ["m-1"],
			platforms: ["INSTAGRAM"],
			// Stories não é destino deste post; 9:16 não serve ao feed.
			art: { INSTAGRAM: stories, INSTAGRAM_STORIES: stories, FACEBOOK: feed },
			createdAt: CRIADO,
		}).unwrap();
		expect(post.artSelections).toEqual({});
		expect(post.artContent).toBeNull();
	});

	it("chooseArt troca e tira a arte no rascunho, limpando textos de caixa inexistente", () => {
		const post = rascunho({ platforms: ["INSTAGRAM", "FACEBOOK"] });
		expect(
			post
				.chooseArt("FACEBOOK", {
					...feed,
					texts: { titulo: "Outro", sumiu: "x" },
				})
				.isOk(),
		).toBe(true);
		expect(post.artFor("FACEBOOK")?.texts).toEqual({ titulo: "Outro" });

		expect(post.chooseArt("FACEBOOK", null).isOk()).toBe(true);
		expect(post.artFor("FACEBOOK")).toBeNull();
	});

	it("chooseArt recusa destino que o post não tem, e formato que não serve", () => {
		const post = rascunho({ platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"] });

		const fora = post.chooseArt("FACEBOOK", feed).unwrapErr();
		expect(fora.name).toBe("InvalidArtChoice");
		expect(fora.message).toContain("Facebook");

		const formato = post.chooseArt("INSTAGRAM_STORIES", feed).unwrapErr();
		expect(formato.message).toBe(
			'O padrão "Últimas" é 4:5, e Stories do Instagram pede 9:16.',
		);
		expect(post.chooseArt("INSTAGRAM", stories).unwrapErr().message).toContain(
			"1:1 ou 4:5",
		);
	});

	it("depois de aprovado, a arte congela como o texto (D8)", () => {
		const post = comArte();
		post.approve("staff-1", AGORA);
		expect(post.chooseArt("INSTAGRAM", null).unwrapErr().name).toBe(
			"InvalidPostTransition",
		);
		expect(post.setArtContent(conteudo).unwrapErr().name).toBe(
			"InvalidPostTransition",
		);
		expect(post.artFor("INSTAGRAM")).not.toBeNull();
	});

	it("tirar o destino leva a arte junto", () => {
		const post = comArte();
		post.edit({ platforms: ["INSTAGRAM"] });
		expect(post.artFor("INSTAGRAM_STORIES")).toBeNull();
		expect(post.artFor("INSTAGRAM")).not.toBeNull();
	});

	it("desenha com o conteúdo guardado; sem ele, com a primeira linha da legenda", () => {
		expect(comArte().artContentForDrawing()).toEqual(conteudo);
		const avulso = rascunho({
			captionText: "\n  Bom dia, Piracuruca  \nLegenda",
		});
		expect(avulso.artContentForDrawing()).toEqual(
			contentWithHeadline("Bom dia, Piracuruca"),
		);
	});

	it("setArtContent troca o conteúdo das caixas no rascunho", () => {
		const post = comArte();
		post.setArtContent({ ...conteudo, headline: "Título corrigido" });
		expect(post.artContent?.headline).toBe("Título corrigido");
	});

	it("post gravado antes dos padrões restaura sem arte", () => {
		const post = SocialPost.restore({
			id: "antigo",
			articleId: null,
			origin: "MANUAL",
			caption: Caption.restore("Oi"),
			mediaIds: ["m-1"],
			linkUrl: null,
			deliveries: [Delivery.pending("INSTAGRAM")],
			status: "RASCUNHO",
			createdAt: CRIADO,
			approvedAt: null,
			approvedByStaffId: null,
		});
		expect(post.artFor("INSTAGRAM")).toBeNull();
		expect(post.artContent).toBeNull();
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

describe("publicação manual dos Stories (spec 11)", () => {
	function comStory(modes: DeliveryModes = {}) {
		const post = SocialPost.draft({
			id: "post-s",
			articleId: "art-1",
			origin: "MATERIA",
			captionText: "Plantão",
			mediaIds: ["media-1"],
			linkUrl: "https://fm7cidades.com/x",
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			modes,
			createdAt: CRIADO,
		}).unwrap();
		post.approve("editor-1", AGORA);
		post.pullEvents();
		return post;
	}

	it("o modo vem do pedido ou do padrão, e a edição mantém o que não veio", () => {
		const post = SocialPost.draft({
			id: "p",
			origin: "MANUAL",
			captionText: "oi",
			mediaIds: ["m"],
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			modes: { INSTAGRAM_STORIES: "AUTOMATICO" },
			createdAt: CRIADO,
		}).unwrap();
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.mode).toBe("AUTOMATICO");

		post.edit({ captionText: "outra", platforms: ["INSTAGRAM_STORIES"] });
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.mode).toBe("AUTOMATICO");

		post.edit({ modes: { INSTAGRAM_STORIES: "MANUAL" } });
		expect(post.targets).toEqual(["INSTAGRAM_STORIES"]);
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.mode).toBe("MANUAL");
	});

	it("feed no ar e story preparado: o post espera uma pessoa (D4)", () => {
		const post = comStory();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		expect(post.status).toBe("PUBLICANDO");

		post.recordPrepared("INSTAGRAM_STORIES", "https://cdn.test/a.jpg", AGORA);
		expect(post.status).toBe("AGUARDANDO_PESSOA");
		expect(post.pendingDeliveries()).toHaveLength(0);
	});

	it("'Já publiquei' põe no ar, com quem publicou no evento", () => {
		const post = comStory();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		post.recordPrepared("INSTAGRAM_STORIES", "u", AGORA);
		post.pullEvents();

		const feito = post.confirmManualPublish(
			"INSTAGRAM_STORIES",
			"editor-2",
			"https://instagr.am/s/1",
			AGORA,
		);

		expect(feito.isOk()).toBe(true);
		expect(post.status).toBe("PUBLICADO");
		const [evento] = post.pullEvents();
		expect(evento).toBeInstanceOf(SocialPostPublished);
		expect(evento).toMatchObject({
			remoteId: null,
			publishedByStaffId: "editor-2",
			permalink: "https://instagr.am/s/1",
		});
	});

	it("confirmar o que ainda não tem arte é recusado, dizendo o estado", () => {
		const post = comStory();
		const recusado = post.confirmManualPublish(
			"INSTAGRAM_STORIES",
			"editor-2",
			null,
			AGORA,
		);
		expect(recusado.isErr()).toBe(true);
		expect(recusado.unwrapErr()).toBeInstanceOf(InvalidDeliveryTransition);
		expect(recusado.unwrapErr().message).toContain("PENDENTE");

		expect(
			post.confirmManualPublish("FACEBOOK", "editor-2", null, AGORA).isErr(),
		).toBe(true);
	});

	it("dispensar: feed no ar + story dispensado é PUBLICADO; tudo dispensado é CANCELADA", () => {
		const post = comStory();
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		post.recordPrepared("INSTAGRAM_STORIES", "u", AGORA);
		post.pullEvents();

		expect(
			post.dismissDelivery("INSTAGRAM_STORIES", "editor-2", AGORA).isOk(),
		).toBe(true);
		expect(post.status).toBe("PUBLICADO");
		expect(post.pullEvents()[0]).toBeInstanceOf(SocialDeliveryDismissed);
		expect(
			post.dismissDelivery("INSTAGRAM_STORIES", "editor-2", AGORA).isErr(),
		).toBe(true);

		const soStory = SocialPost.draft({
			id: "p2",
			origin: "MANUAL",
			captionText: "oi",
			mediaIds: ["m"],
			platforms: ["INSTAGRAM_STORIES"],
			createdAt: CRIADO,
		}).unwrap();
		soStory.approve("editor-1", AGORA);
		soStory.recordPrepared("INSTAGRAM_STORIES", "u", AGORA);
		soStory.dismissDelivery("INSTAGRAM_STORIES", "editor-1", AGORA);
		expect(soStory.status).toBe("CANCELADA");
	});

	it("feed recusado com story esperando: o 'tentar de novo' reenvia só o feed", () => {
		const post = comStory();
		post.recordFailure("INSTAGRAM", "recusou", AGORA);
		post.recordPrepared("INSTAGRAM_STORIES", "u", AGORA);
		expect(post.status).toBe("AGUARDANDO_PESSOA");

		expect(post.retryFailed().isOk()).toBe(true);
		expect(post.status).toBe("PUBLICANDO");
		expect(post.deliveryFor("INSTAGRAM")?.isPending()).toBe(true);
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.isAwaitingPerson()).toBe(
			true,
		);
	});

	it("sem nada que falhou, 'tentar de novo' é recusado", () => {
		const post = comStory();
		expect(post.retryFailed().isErr()).toBe(true);
	});

	it("story automático que falhou vai à mão e volta para ser preparado (D8)", () => {
		const post = comStory({ INSTAGRAM_STORIES: "AUTOMATICO" });
		post.recordSuccess("INSTAGRAM", "ig-1", null, AGORA);
		post.recordFailure("INSTAGRAM_STORIES", "recusou", AGORA);
		expect(post.status).toBe("PARCIAL");

		expect(post.publishManually("INSTAGRAM_STORIES").isOk()).toBe(true);
		expect(post.status).toBe("PUBLICANDO");
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.mode).toBe("MANUAL");
		expect(post.publishManually("INSTAGRAM").isErr()).toBe(true);
	});
});

// ── vídeo (spec 12) ────────────────────────────────────────────────────────

describe("SocialPost — vídeo", () => {
	const CORTE = {
		mediaId: "video-1",
		sourceSeconds: 120,
		startSeconds: 0,
		endSeconds: 30,
		muted: false,
	};

	const comVideo = (
		platforms: readonly SocialDestination[] = ["INSTAGRAM_REELS"],
		clips: readonly (typeof CORTE)[] = [CORTE],
	) =>
		SocialPost.draft({
			id: "p-1",
			origin: "MANUAL",
			captionText: "Entrevista",
			mediaIds: ["video-1"],
			platforms,
			clips,
			createdAt: AGORA,
		}).unwrap();

	it("um post com trechos sabe que é de vídeo", () => {
		expect(comVideo().isVideo).toBe(true);
		expect(comVideo().clips).toEqual([CORTE]);
	});

	it("os trechos entram aparados — a alça além do arquivo para no fim dele", () => {
		const post = comVideo(
			["INSTAGRAM_REELS"],
			[{ ...CORTE, endSeconds: 9999 }],
		);
		expect(post.clips[0]?.endSeconds).toBe(120);
	});

	it("depois de aprovado, o vídeo está congelado como o texto", () => {
		const post = comVideo();
		post.approve("editor-1", AGORA);
		expect(post.setVideo([]).isErr()).toBe(true);
		expect(post.isVideo).toBe(true);
	});

	it("o Reels exige vídeo, e diz isso antes do clique", () => {
		const semVideo = SocialPost.draft({
			id: "p-2",
			origin: "MANUAL",
			captionText: "Nota",
			mediaIds: ["media-1"],
			platforms: ["INSTAGRAM_REELS"],
			createdAt: AGORA,
		}).unwrap();
		expect(semVideo.publicationBlockers()).toContain(
			"O Reels do Instagram publica vídeo, e este post não tem um.",
		);
	});

	it("o feed de fotos recusa vídeo, e diz isso antes do clique", () => {
		expect(comVideo(["INSTAGRAM"]).publicationBlockers()).toContain(
			"O Instagram não publica vídeo.",
		);
	});

	it("os limites de duração da rede aparecem entre os impedimentos", () => {
		const longo = comVideo(
			["INSTAGRAM_STORIES"],
			[{ ...CORTE, endSeconds: 80 }],
		);
		expect(longo.publicationBlockers()).toEqual([
			expect.stringContaining("Stories do Instagram aceita até"),
		]);
	});

	it("a régua mede a SOMA dos trechos, não cada um", () => {
		const post = comVideo(
			["INSTAGRAM_STORIES"],
			[
				{ ...CORTE, endSeconds: 40 },
				{ ...CORTE, endSeconds: 40 },
			],
		);
		expect(post.publicationBlockers()).toEqual([
			expect.stringContaining("Stories do Instagram aceita até"),
		]);
	});

	it("faltando arquivo, o Reels pede VÍDEO e o feed pede imagem", () => {
		// A frase sai do DESTINO, não do que o post já tem: sem arquivo nenhum
		// não há vídeo, e pedir "uma imagem" a quem escolheu o Reels mandaria a
		// redação procurar a coisa errada.
		const reels = comVideo();
		reels.edit({ mediaIds: [] });
		expect(reels.publicationBlockers()).toContain(
			"A publicação precisa de um vídeo.",
		);

		const feed = comVideo(["INSTAGRAM"]);
		feed.edit({ mediaIds: [] });
		expect(feed.publicationBlockers()).toContain(
			"A publicação precisa de ao menos uma imagem.",
		);
	});

	it("vídeo bom no Reels e nos Stories não tem impedimento nenhum", () => {
		expect(
			comVideo(["INSTAGRAM_REELS", "INSTAGRAM_STORIES"]).publicationBlockers(),
		).toEqual([]);
	});
});

describe("SocialPost — montar o vídeo ANEXA os arquivos", () => {
	const corte = (mediaId: string, over = {}) => ({
		mediaId,
		sourceSeconds: 120,
		startSeconds: 0,
		endSeconds: 30,
		muted: false,
		...over,
	});

	const rascunho = (mediaIds: readonly string[] = []) =>
		SocialPost.draft({
			id: "p-1",
			origin: "MANUAL",
			captionText: "Entrevista",
			mediaIds,
			platforms: ["INSTAGRAM_REELS"],
			createdAt: AGORA,
		}).unwrap();

	it("montar num post VAZIO anexa o arquivo — senão a escolha some", () => {
		// Foi o defeito da primeira versão: `setVideo` exigia que o arquivo já
		// fosse a primeira mídia, e nada nunca o punha lá. O seletor fechava e
		// o vídeo desaparecia sem erro nenhum.
		const post = rascunho();

		expect(post.setVideo([corte("video-1")]).isOk()).toBe(true);
		expect(post.clips).toHaveLength(1);
		expect(post.mediaIds).toEqual(["video-1"]);
	});

	it("o vídeo TROCA as imagens que estivessem lá — um post é de um ou de outro", () => {
		const post = rascunho(["foto-1", "foto-2"]);

		post.setVideo([corte("video-1")]);

		expect(post.mediaIds).toEqual(["video-1"]);
		expect(post.isVideo).toBe(true);
	});

	it("dois trechos do MESMO arquivo anexam o arquivo uma vez só", () => {
		// Pegar dois momentos de uma entrevista é o caso normal; contar o arquivo
		// duas vezes faria a biblioteca achar que há dois vídeos em uso.
		const post = rascunho();

		post.setVideo([
			corte("video-1", { endSeconds: 10 }),
			corte("video-1", { startSeconds: 40, endSeconds: 50 }),
		]);

		expect(post.clips).toHaveLength(2);
		expect(post.mediaIds).toEqual(["video-1"]);
	});

	it("trechos de arquivos diferentes anexam os dois, na ordem em que aparecem", () => {
		const post = rascunho();

		post.setVideo([corte("video-2"), corte("video-1")]);

		expect(post.mediaIds).toEqual(["video-2", "video-1"]);
	});

	it("lista vazia tira o vídeo e os arquivos junto", () => {
		const post = rascunho();
		post.setVideo([corte("video-1")]);

		post.setVideo([]);

		expect(post.isVideo).toBe(false);
		expect(post.mediaIds).toEqual([]);
	});

	it("tirar um arquivo do post descarta os trechos dele, e só eles", () => {
		const post = rascunho();
		post.setVideo([corte("video-1"), corte("video-2")]);

		post.edit({ mediaIds: ["video-1"] });

		expect(post.clips.map((clip) => clip.mediaId)).toEqual(["video-1"]);
	});
});
