import { newPrismaClient } from "@portal-app/db/client";
import {
	ArtTemplate,
	Caption,
	DEFAULT_TEXT_STYLE,
	Delivery,
	SocialAccount,
	SocialPost,
	selectionFrom,
} from "@portal-app/social";
import { PrismaSocialAccountRepository } from "@portal-app/social/infrastructure/prisma-social-account-repository";
import { PrismaSocialPostRepository } from "@portal-app/social/infrastructure/prisma-social-post-repository";
import { TokenCipher } from "@portal-app/social/infrastructure/token-cipher";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));
const posts = new PrismaSocialPostRepository(prisma);
const cipher = new TokenCipher("um-segredo-de-teste-com-mais-de-32-caracteres");
const accounts = new PrismaSocialAccountRepository(prisma, cipher);

afterAll(async () => {
	await prisma.$disconnect();
});

beforeEach(async () => {
	await prisma.socialDelivery.deleteMany();
	await prisma.socialPost.deleteMany();
	await prisma.socialAccount.deleteMany();
	await prisma.outboxEvent.deleteMany();
});

const AGORA = new Date("2026-09-11T12:00:00Z");

function rascunho(id = "post-1", articleId: string | null = "art-1") {
	return SocialPost.draft({
		id,
		articleId,
		origin: "AUTOMATICA",
		captionText: "Chuva alaga o centro 🌧️ #Piracuruca",
		mediaIds: ["media-1", "media-2"],
		linkUrl: "https://fm7cidades.com/cidades/chuva",
		platforms: ["INSTAGRAM", "FACEBOOK"],
		createdAt: AGORA,
	}).unwrap();
}

describe("PrismaSocialPostRepository", () => {
	it("guarda e devolve o post inteiro, com as entregas", async () => {
		const original = rascunho();
		await posts.save(original);

		const lido = await posts.findById("post-1");

		expect(lido?.caption.value).toBe("Chuva alaga o centro 🌧️ #Piracuruca");
		// A ORDEM das imagens é conteúdo: a primeira é a capa do carrossel.
		expect(lido?.mediaIds).toEqual(["media-1", "media-2"]);
		expect(lido?.linkUrl).toBe("https://fm7cidades.com/cidades/chuva");
		expect(lido?.targets).toEqual(["FACEBOOK", "INSTAGRAM"]);
		expect(lido?.status).toBe("RASCUNHO");
	});

	it("grava os eventos no outbox, na MESMA transação", async () => {
		await posts.save(rascunho());

		const eventos = await prisma.outboxEvent.findMany({
			where: { aggregateId: "post-1" },
		});
		expect(eventos.map((evento) => evento.eventName)).toEqual([
			"SocialPostDrafted",
		]);
		expect(eventos[0]?.processedAt).toBeNull();
	});

	it("preserva o remoteId de cada entrega entre gravações", async () => {
		const post = rascunho();
		await posts.save(post);

		post.approve("editor-1", AGORA);
		post.recordSuccess("INSTAGRAM", "ig-123", "https://instagr.am/p/x", AGORA);
		post.recordFailure("FACEBOOK", "token expirado", AGORA);
		await posts.save(post);

		const lido = await posts.findById("post-1");
		expect(lido?.status).toBe("PARCIAL");
		expect(lido?.deliveryFor("INSTAGRAM")?.remoteId).toBe("ig-123");
		expect(lido?.deliveryFor("INSTAGRAM")?.permalink).toBe(
			"https://instagr.am/p/x",
		);
		expect(lido?.deliveryFor("FACEBOOK")?.error).toBe("token expirado");
		expect(lido?.deliveryFor("FACEBOOK")?.attempts).toBe(1);
	});

	it("tirar uma rede do rascunho apaga a entrega dela", async () => {
		const post = rascunho();
		await posts.save(post);

		post.edit({ platforms: ["INSTAGRAM"] });
		await posts.save(post);

		const lido = await posts.findById("post-1");
		expect(lido?.targets).toEqual(["INSTAGRAM"]);
		expect(await prisma.socialDelivery.count()).toBe(1);
	});

	/**
	 * A trava que o `existsForArticle` sozinho não dá: ele responde sobre o
	 * estado de UM instante, e o outbox pode despachar o mesmo evento em dois
	 * relays simultâneos. Só o índice único resiste a isso.
	 */
	it("o banco RECUSA um segundo post automático da mesma matéria", async () => {
		await posts.save(rascunho("post-1"));

		await expect(posts.save(rascunho("post-2"))).rejects.toThrow();
		expect(await posts.existsForArticle("art-1")).toBe(true);
	});

	it("o post preparado no editor da matéria também trava, e findForArticle o acha (spec 09, F6)", async () => {
		const daMateria = SocialPost.draft({
			id: "post-materia",
			articleId: "art-7",
			origin: "MATERIA",
			captionText: "Preparado na matéria",
			mediaIds: ["media-1"],
			platforms: ["INSTAGRAM"],
			createdAt: AGORA,
		}).unwrap();
		await posts.save(daMateria);

		// Um manual da mesma matéria não é "o post da matéria".
		await posts.save(
			SocialPost.draft({
				id: "post-manual",
				articleId: "art-7",
				origin: "MANUAL",
				captionText: "Avulso",
				mediaIds: ["media-1"],
				platforms: ["FACEBOOK"],
				createdAt: new Date(AGORA.getTime() + 1000),
			}).unwrap(),
		);

		expect(await posts.existsForArticle("art-7")).toBe(true);
		expect((await posts.findForArticle("art-7"))?.id).toBe("post-materia");
		expect(await posts.findForArticle("art-sem-post")).toBeNull();

		// E o banco recusa um automático para a mesma matéria.
		await expect(posts.save(rascunho("post-auto", "art-7"))).rejects.toThrow();
	});

	it("mas aceita quantos posts MANUAIS quiserem da mesma matéria", async () => {
		// O índice único ignora nulos em Postgres, e `autoKey` é nulo no manual.
		for (const id of ["m-1", "m-2", "m-3"]) {
			const post = SocialPost.restore({
				id,
				articleId: "art-1",
				origin: "MANUAL",
				caption: Caption.restore("Relembre"),
				mediaIds: ["media-1"],
				linkUrl: null,
				deliveries: [Delivery.pending("INSTAGRAM")],
				status: "RASCUNHO",
				createdAt: AGORA,
				approvedAt: null,
				approvedByStaffId: null,
			});
			await posts.save(post);
		}
		expect(await prisma.socialPost.count()).toBe(3);
		// E nenhum deles conta como duplicata do gatilho automático.
		expect(await posts.existsForArticle("art-1")).toBe(false);
	});

	it("lista, filtra e conta o que espera aprovação", async () => {
		await posts.save(rascunho("post-1", "art-1"));
		const aprovado = rascunho("post-2", "art-2");
		aprovado.approve("editor-1", AGORA);
		await posts.save(aprovado);

		const fila = await posts.list(
			{ status: "RASCUNHO" },
			{ limit: 10, offset: 0 },
		);
		expect(fila.total).toBe(1);
		expect(await posts.countPending()).toBe(1);

		const aguardando = await posts.listAwaitingDelivery(10);
		expect(aguardando.map((post) => post.id)).toEqual(["post-2"]);
	});

	it("guarda a entrega dos Stories na mesma coluna, sem migration (§17)", async () => {
		const post = SocialPost.draft({
			id: "post-s",
			origin: "MANUAL",
			captionText: "Plantão",
			mediaIds: ["media-1"],
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			createdAt: AGORA,
		}).unwrap();
		await posts.save(post);

		post.approve("editor-1", AGORA);
		post.recordSuccess("INSTAGRAM_STORIES", "story-1", null, AGORA);
		await posts.save(post);

		const lido = await posts.findById("post-s");
		expect(lido?.targets).toEqual(["INSTAGRAM", "INSTAGRAM_STORIES"]);
		expect(lido?.deliveryFor("INSTAGRAM_STORIES")?.remoteId).toBe("story-1");
		expect(lido?.deliveryFor("INSTAGRAM")?.isPending()).toBe(true);

		const soStories = await posts.list(
			{ platform: "INSTAGRAM_STORIES" },
			{ limit: 10, offset: 0 },
		);
		expect(soStories.items.map((item) => item.id)).toEqual(["post-s"]);
	});

	it("guarda a arte de cada destino e o conteúdo das caixas (spec 09, F5)", async () => {
		const template = ArtTemplate.create({
			id: "tpl-1",
			name: "Últimas — feed",
			format: "4:5",
			layers: [
				{
					id: "titulo",
					kind: "TEXT",
					box: { x: 130, y: 560, width: 820, height: 240 },
					source: "HEADLINE",
					text: "",
					style: { ...DEFAULT_TEXT_STYLE },
				},
			],
			createdAt: AGORA,
		}).unwrap();
		const post = SocialPost.draft({
			id: "post-arte",
			origin: "MANUAL",
			captionText: "Plantão",
			mediaIds: ["media-1"],
			platforms: ["INSTAGRAM", "FACEBOOK"],
			art: { INSTAGRAM: selectionFrom(template, { titulo: "Título trocado" }) },
			artContent: {
				headline: "Chuva alaga o centro",
				kicker: "Últimas",
				sectionName: null,
			},
			createdAt: AGORA,
		}).unwrap();
		await posts.save(post);

		const lido = await posts.findById("post-arte");

		// A cópia do padrão volta inteira — camadas, versão e o texto trocado.
		expect(lido?.artFor("INSTAGRAM")).toEqual(post.artFor("INSTAGRAM"));
		expect(lido?.artFor("INSTAGRAM")?.overrides).toEqual({
			titulo: "Título trocado",
		});
		expect(lido?.artFor("FACEBOOK")).toBeNull();
		expect(lido?.artContent).toEqual({
			headline: "Chuva alaga o centro",
			kicker: "Últimas",
			sectionName: null,
		});
	});

	it("post sem arte volta sem arte e sem conteúdo", async () => {
		await posts.save(rascunho());
		const lido = await posts.findById("post-1");
		expect(lido?.artSelections).toEqual({});
		expect(lido?.artContent).toBeNull();
	});

	it("filtra por rede", async () => {
		const so_instagram = SocialPost.restore({
			id: "post-ig",
			articleId: null,
			origin: "MANUAL",
			caption: Caption.restore("Só no Instagram"),
			mediaIds: ["m-1"],
			linkUrl: null,
			deliveries: [Delivery.pending("INSTAGRAM")],
			status: "RASCUNHO",
			createdAt: AGORA,
			approvedAt: null,
			approvedByStaffId: null,
		});
		await posts.save(so_instagram);
		await posts.save(rascunho());

		const noFacebook = await posts.list(
			{ platform: "FACEBOOK" },
			{ limit: 10, offset: 0 },
		);
		expect(noFacebook.items.map((post) => post.id)).toEqual(["post-1"]);
	});
});

describe("PrismaSocialAccountRepository", () => {
	function conta(id = "acc-1") {
		return SocialAccount.connect({
			id,
			platform: "INSTAGRAM",
			remoteId: "17841405309211844",
			displayName: "@radio7cidades",
			tokenExpiresAt: new Date("2026-11-10T00:00:00Z"),
			connectedAt: AGORA,
			connectedByStaffId: "admin-1",
		});
	}

	it("guarda a conta e devolve o token decifrado só por credentialsFor", async () => {
		await accounts.connect(conta(), "EAACwTOKEN-de-verdade");

		const lida = await accounts.findByPlatform("INSTAGRAM");
		expect(lida?.displayName).toBe("@radio7cidades");
		// O agregado NÃO tem token — é o que impede vazá-lo em DTO ou log.
		expect(JSON.stringify(lida)).not.toContain("EAACwTOKEN");

		const credenciais = await accounts.credentialsFor("INSTAGRAM");
		expect(credenciais?.accessToken).toBe("EAACwTOKEN-de-verdade");
	});

	it("o token fica CIFRADO no banco", async () => {
		await accounts.connect(conta(), "EAACwTOKEN-de-verdade");

		const linha = await prisma.socialAccount.findUnique({
			where: { platform: "INSTAGRAM" },
		});
		expect(linha?.accessToken).not.toContain("EAACwTOKEN");
		expect(linha?.accessToken.startsWith("v1.")).toBe(true);
	});

	it("salvar o agregado NÃO apaga o token", async () => {
		// O caminho real: desconectar chama `save`, e um `save` que gravasse o
		// objeto inteiro zeraria a credencial sem ninguém perceber.
		await accounts.connect(conta(), "EAACwTOKEN-de-verdade");
		const account = await accounts.findByPlatform("INSTAGRAM");
		account?.renew(new Date("2027-01-01T00:00:00Z"));
		if (account) {
			await accounts.save(account);
		}

		const linha = await prisma.socialAccount.findUnique({
			where: { platform: "INSTAGRAM" },
		});
		expect(cipher.decrypt(linha?.accessToken ?? "")).toBe(
			"EAACwTOKEN-de-verdade",
		);
	});

	it("reconectar a mesma rede SUBSTITUI a conta anterior (D5)", async () => {
		await accounts.connect(conta("acc-1"), "token-antigo");
		await accounts.connect(conta("acc-2"), "token-novo");

		expect(await prisma.socialAccount.count()).toBe(1);
		expect((await accounts.credentialsFor("INSTAGRAM"))?.accessToken).toBe(
			"token-novo",
		);
	});

	it("conta desconectada não entrega credencial", async () => {
		await accounts.connect(conta(), "token");
		const account = await accounts.findByPlatform("INSTAGRAM");
		account?.disconnect();
		if (account) {
			await accounts.save(account);
		}

		expect(await accounts.credentialsFor("INSTAGRAM")).toBeNull();
		// Mas o registro FICA: o histórico de posts aponta para ele.
		expect(await prisma.socialAccount.count()).toBe(1);
	});

	it("esquecer APAGA o token do banco e desliga a conta (exclusão de dados)", async () => {
		await accounts.connect(conta(), "EAACwTOKEN-de-verdade");

		expect(await accounts.forget("INSTAGRAM")).toBe(true);

		const linha = await prisma.socialAccount.findUnique({
			where: { platform: "INSTAGRAM" },
		});
		// Nem cifrado: o segredo deixou de existir.
		expect(linha?.accessToken).toBe("");
		expect(linha?.status).toBe("DESCONECTADA");
		expect(await accounts.credentialsFor("INSTAGRAM")).toBeNull();
	});

	it("esquecer rede sem conta devolve false", async () => {
		expect(await accounts.forget("FACEBOOK")).toBe(false);
	});

	it("reconectar depois de esquecer volta a publicar", async () => {
		await accounts.connect(conta("acc-1"), "token-antigo");
		await accounts.forget("INSTAGRAM");
		await accounts.connect(conta("acc-2"), "token-novo");

		expect((await accounts.credentialsFor("INSTAGRAM"))?.accessToken).toBe(
			"token-novo",
		);
	});
});
