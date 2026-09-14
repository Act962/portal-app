import { FixedClock } from "@portal-app/shared-kernel";
import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	MAX_AUTOMATIC_ATTEMPTS,
	publishPendingPosts,
	SocialAccount,
	type SocialPlatform,
	SocialPost,
	selectionFrom,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import {
	FakeImageSource,
	InMemorySocialAccountRepository,
	InMemorySocialPostRepository,
	SpySocialPublisher,
} from "./doubles";

const AGORA = new Date("2026-09-11T12:00:00Z");

let repo: InMemorySocialPostRepository;
let accounts: InMemorySocialAccountRepository;
let publisher: SpySocialPublisher;
let images: FakeImageSource;
let deps: Parameters<typeof publishPendingPosts>[0];

function conectar(
	platform: SocialPlatform,
	tokenExpiresAt: Date | null = null,
) {
	const account = SocialAccount.connect({
		id: `acc-${platform}`,
		platform,
		remoteId: `remote-${platform}`,
		displayName: `Conta do ${platform}`,
		tokenExpiresAt,
		connectedAt: AGORA,
		connectedByStaffId: "admin-1",
	});
	accounts.accounts.set(platform, account);
	return account;
}

async function postAprovado(
	platforms: readonly SocialPlatform[] = ["INSTAGRAM", "FACEBOOK"],
	mediaIds: readonly string[] = ["media-1"],
) {
	const post = SocialPost.draft({
		id: "post-1",
		articleId: "art-1",
		origin: "AUTOMATICA",
		captionText: "Chuva alaga o centro",
		mediaIds,
		linkUrl: "https://fm7cidades.com/cidades/chuva",
		platforms,
		createdAt: AGORA,
	}).unwrap();
	post.approve("editor-1", AGORA);
	post.pullEvents();
	await repo.save(post);
	return post;
}

beforeEach(() => {
	repo = new InMemorySocialPostRepository();
	accounts = new InMemorySocialAccountRepository();
	publisher = new SpySocialPublisher();
	images = new FakeImageSource();
	deps = { repo, accounts, publisher, images, clock: new FixedClock(AGORA) };
});

describe("publishPendingPosts", () => {
	it("entrega às duas redes e guarda a prova de cada uma", async () => {
		conectar("INSTAGRAM");
		conectar("FACEBOOK");
		publisher.succeedOn("INSTAGRAM", "ig-1").succeedOn("FACEBOOK", "fb-1");
		const post = await postAprovado();

		const resultado = await publishPendingPosts(deps);

		expect(resultado).toEqual({
			posts: 1,
			published: 2,
			failed: 0,
			retrying: 0,
		});
		expect(post.status).toBe("PUBLICADO");
		expect(post.deliveryFor("INSTAGRAM")?.remoteId).toBe("ig-1");
		expect(post.deliveryFor("FACEBOOK")?.remoteId).toBe("fb-1");
	});

	it("manda para cada rede a legenda DAQUELA rede", async () => {
		conectar("INSTAGRAM");
		conectar("FACEBOOK");
		await postAprovado();

		await publishPendingPosts(deps);

		const paraInstagram = publisher.requests.find(
			(request) => request.platform === "INSTAGRAM",
		);
		const paraFacebook = publisher.requests.find(
			(request) => request.platform === "FACEBOOK",
		);
		expect(paraInstagram?.caption).not.toContain("https://");
		expect(paraFacebook?.caption).toContain(
			"https://fm7cidades.com/cidades/chuva",
		);
	});

	it("resolve as imagens na ordem, com a URL pública e o alt", async () => {
		conectar("INSTAGRAM");
		await postAprovado(["INSTAGRAM"], ["m-1", "m-2", "m-3"]);

		await publishPendingPosts(deps);

		expect(publisher.requests[0]?.images.map((image) => image.url)).toEqual([
			"https://cdn.test/m-1.jpg",
			"https://cdn.test/m-2.jpg",
			"https://cdn.test/m-3.jpg",
		]);
		expect(publisher.requests[0]?.images[0]?.altText).toBe("alt de m-1");
	});

	it("uma rede falha e a outra não — o post fica PARCIAL", async () => {
		conectar("INSTAGRAM");
		conectar("FACEBOOK");
		publisher
			.succeedOn("FACEBOOK", "fb-1")
			.failOn("INSTAGRAM", "A imagem precisa ser JPEG.");
		const post = await postAprovado();

		const resultado = await publishPendingPosts(deps);

		expect(resultado).toEqual({
			posts: 1,
			published: 1,
			failed: 1,
			retrying: 0,
		});
		expect(post.status).toBe("PARCIAL");
		expect(post.deliveryFor("INSTAGRAM")?.error).toBe(
			"A imagem precisa ser JPEG.",
		);
		expect(post.deliveryFor("FACEBOOK")?.remoteId).toBe("fb-1");
	});

	it("uma segunda rodada NÃO reenvia o que já saiu", async () => {
		// A garantia que sustenta o retry inteiro: o que está no ar fica no ar,
		// uma vez só.
		conectar("INSTAGRAM");
		conectar("FACEBOOK");
		publisher.succeedOn("FACEBOOK", "fb-1").failOn("INSTAGRAM", "falhou");
		const post = await postAprovado();
		await publishPendingPosts(deps);

		post.retryFailed();
		await repo.save(post);
		publisher.succeedOn("INSTAGRAM", "ig-2");
		await publishPendingPosts(deps);

		expect(post.status).toBe("PUBLICADO");
		expect(post.deliveryFor("FACEBOOK")?.remoteId).toBe("fb-1");
		expect(
			publisher.requests.filter((r) => r.platform === "FACEBOOK"),
		).toHaveLength(1);
	});

	describe("falhas que nem chegam à Meta", () => {
		it("conta não conectada vira erro explicando o que fazer", async () => {
			conectar("INSTAGRAM");
			const post = await postAprovado();

			await publishPendingPosts(deps);

			expect(post.deliveryFor("FACEBOOK")?.error).toContain(
				"Nenhuma conta do Facebook",
			);
			expect(publisher.requests.some((r) => r.platform === "FACEBOOK")).toBe(
				false,
			);
		});

		it("token vencido não gasta uma tentativa na Meta", async () => {
			// Chamar com token morto queima cota e devolve um erro genérico que
			// manda a redação procurar defeito no lugar errado.
			conectar("INSTAGRAM", new Date("2026-09-01T00:00:00Z"));
			const post = await postAprovado(["INSTAGRAM"]);

			await publishPendingPosts(deps);

			expect(post.status).toBe("FALHOU");
			expect(post.deliveryFor("INSTAGRAM")?.error).toContain("venceu");
			expect(publisher.requests).toHaveLength(0);
		});

		it("imagem sumida da biblioteca aborta a entrega inteira", async () => {
			// Um carrossel com buraco no meio é pior que nenhum post.
			conectar("INSTAGRAM");
			images.missing.add("m-2");
			const post = await postAprovado(["INSTAGRAM"], ["m-1", "m-2"]);

			await publishPendingPosts(deps);

			expect(post.deliveryFor("INSTAGRAM")?.error).toContain(
				"não está mais na biblioteca",
			);
			expect(publisher.requests).toHaveLength(0);
		});

		it("imagem em endereço interno falha antes de chamar a Meta", async () => {
			// O ambiente de dev: MinIO em localhost. A Meta nunca alcançaria a foto,
			// e o erro dela ("não foi possível baixar") não diria por quê.
			conectar("INSTAGRAM");
			images.baseUrl = "http://localhost:9000/portal-media";
			const post = await postAprovado(["INSTAGRAM"]);

			const resultado = await publishPendingPosts(deps);

			expect(resultado.failed).toBe(1);
			expect(post.deliveryFor("INSTAGRAM")?.error).toContain(
				"endereço interno",
			);
			expect(publisher.requests).toHaveLength(0);
		});
	});

	describe("falha passageira", () => {
		it("NÃO vira FALHOU: fica na fila, com o motivo visível", async () => {
			conectar("INSTAGRAM");
			publisher.failOn(
				"INSTAGRAM",
				"O Instagram está instável no momento.",
				true,
			);
			const post = await postAprovado(["INSTAGRAM"]);

			const resultado = await publishPendingPosts(deps);

			expect(resultado).toEqual({
				posts: 1,
				published: 0,
				failed: 0,
				retrying: 1,
			});
			expect(post.status).toBe("PUBLICANDO");
			expect(post.deliveryFor("INSTAGRAM")?.error).toContain(
				"Nova tentativa automática",
			);
		});

		it("a rodada seguinte tenta sozinha e publica", async () => {
			conectar("INSTAGRAM");
			publisher.failOn("INSTAGRAM", "Instável.", true);
			const post = await postAprovado(["INSTAGRAM"]);
			await publishPendingPosts(deps);

			publisher.succeedOn("INSTAGRAM", "ig-9");
			await publishPendingPosts(deps);

			expect(post.status).toBe("PUBLICADO");
			expect(post.deliveryFor("INSTAGRAM")?.error).toBeNull();
			expect(publisher.requests).toHaveLength(2);
		});

		it("desiste depois das tentativas automáticas e para de chamar a Meta", async () => {
			conectar("INSTAGRAM");
			publisher.failOn("INSTAGRAM", "Instável.", true);
			const post = await postAprovado(["INSTAGRAM"]);

			for (let round = 0; round < MAX_AUTOMATIC_ATTEMPTS + 2; round += 1) {
				await publishPendingPosts(deps);
			}

			expect(post.status).toBe("FALHOU");
			expect(post.deliveryFor("INSTAGRAM")?.error).toContain("Tentar de novo");
			expect(publisher.requests).toHaveLength(MAX_AUTOMATIC_ATTEMPTS);
		});
	});

	describe("arte do padrão (spec 09, F5)", () => {
		const padrao = ArtTemplate.create({
			id: "tpl-feed",
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

		async function aprovadoComArte(
			mediaIds: readonly string[] = ["m-1", "m-2", "m-3"],
			artContent: {
				headline: string;
				kicker: string | null;
				sectionName: string | null;
			} | null = {
				headline: "Chuva alaga o centro",
				kicker: "Últimas",
				sectionName: "Cidades",
			},
		) {
			const post = SocialPost.draft({
				id: "post-arte",
				origin: "AUTOMATICA",
				articleId: "art-1",
				captionText: "Plantão: chuva forte\n\nMais na matéria.",
				mediaIds,
				platforms: ["INSTAGRAM", "FACEBOOK"],
				art: { INSTAGRAM: selectionFrom(padrao, { titulo: "Título trocado" }) },
				artContent,
				createdAt: AGORA,
			}).unwrap();
			post.approve("editor-1", AGORA);
			post.pullEvents();
			await repo.save(post);
			return post;
		}

		it("destino com padrão publica UMA imagem: a arte, com a primeira foto", async () => {
			conectar("INSTAGRAM");
			conectar("FACEBOOK");
			await aprovadoComArte();

			await publishPendingPosts(deps);

			const instagram = publisher.requests.find(
				(request) => request.platform === "INSTAGRAM",
			);
			expect(instagram?.images.map((image) => image.url)).toEqual([
				"https://cdn.test/art-tpl-feed.jpg",
			]);
			expect(images.artworkRequests).toHaveLength(1);
			expect(images.artworkRequests[0]).toMatchObject({
				photoMediaId: "m-1",
				content: { headline: "Chuva alaga o centro", kicker: "Últimas" },
				selection: {
					templateId: "tpl-feed",
					overrides: { titulo: "Título trocado" },
				},
			});
		});

		it("destino sem padrão continua com as fotos cortadas, como antes", async () => {
			conectar("INSTAGRAM");
			conectar("FACEBOOK");
			await aprovadoComArte();

			await publishPendingPosts(deps);

			const facebook = publisher.requests.find(
				(request) => request.platform === "FACEBOOK",
			);
			expect(facebook?.images).toHaveLength(3);
			expect(images.aspects).toEqual(["1:1", "1:1", "1:1"]);
		});

		it("post avulso desenha a arte com a primeira linha da legenda como título", async () => {
			conectar("INSTAGRAM");
			conectar("FACEBOOK");
			await aprovadoComArte(["m-1"], null);

			await publishPendingPosts(deps);

			expect(images.artworkRequests[0]?.content).toEqual({
				headline: "Plantão: chuva forte",
				kicker: null,
				sectionName: null,
			});
		});

		it("foto da arte que sumiu falha a entrega dizendo isso, sem chamar a Meta", async () => {
			conectar("INSTAGRAM");
			images.missing.add("m-1");
			const post = await aprovadoComArte(["m-1"]);

			await publishPendingPosts(deps);

			expect(post.deliveryFor("INSTAGRAM")?.error).toContain(
				"não está mais na biblioteca",
			);
			expect(
				publisher.requests.some((request) => request.platform === "INSTAGRAM"),
			).toBe(false);
		});
	});

	describe("Stories do Instagram (§17)", () => {
		it("publica com a conta do Instagram, UMA imagem em 9:16 e sem legenda", async () => {
			conectar("INSTAGRAM");
			await postAprovado(["INSTAGRAM_STORIES"], ["m-1", "m-2"]);

			await publishPendingPosts(deps);

			expect(publisher.requests).toHaveLength(1);
			const [story] = publisher.requests;
			expect(story?.platform).toBe("INSTAGRAM");
			expect(story?.format).toBe("STORY");
			expect(story?.accountRemoteId).toBe("remote-INSTAGRAM");
			expect(story?.caption).toBe("");
			expect(story?.images.map((image) => image.url)).toEqual([
				"https://cdn.test/m-1.jpg",
			]);
			// Nem chega a gerar a segunda imagem, que o story não usa.
			expect(images.aspects).toEqual(["9:16"]);
		});

		it("feed e story saem na mesma aprovação, cada um com sua prova", async () => {
			conectar("INSTAGRAM");
			publisher
				.succeedOn("INSTAGRAM", "ig-feed")
				.succeedOn("INSTAGRAM_STORIES", "ig-story");
			const post = await postAprovado(["INSTAGRAM", "INSTAGRAM_STORIES"]);

			const resultado = await publishPendingPosts(deps);

			expect(resultado.published).toBe(2);
			expect(post.status).toBe("PUBLICADO");
			expect(post.deliveryFor("INSTAGRAM")?.remoteId).toBe("ig-feed");
			expect(post.deliveryFor("INSTAGRAM_STORIES")?.remoteId).toBe("ig-story");
			expect(publisher.requests.map((request) => request.format)).toEqual([
				"FEED",
				"STORY",
			]);
			expect(images.aspects).toEqual(["1:1", "9:16"]);
		});

		it("story que falha não derruba o feed, e o reenvio é só do story", async () => {
			conectar("INSTAGRAM");
			publisher
				.succeedOn("INSTAGRAM", "ig-feed")
				.failOn("INSTAGRAM_STORIES", "O Instagram recusou a publicação.");
			const post = await postAprovado(["INSTAGRAM", "INSTAGRAM_STORIES"]);
			await publishPendingPosts(deps);
			expect(post.status).toBe("PARCIAL");

			post.retryFailed();
			await repo.save(post);
			publisher.succeedOn("INSTAGRAM_STORIES", "ig-story");
			await publishPendingPosts(deps);

			expect(post.status).toBe("PUBLICADO");
			expect(
				publisher.requests.filter((request) => request.format === "FEED"),
			).toHaveLength(1);
		});

		it("sem conta do Instagram, o story diz qual CONTA falta", async () => {
			const post = await postAprovado(["INSTAGRAM_STORIES"]);

			await publishPendingPosts(deps);

			expect(post.deliveryFor("INSTAGRAM_STORIES")?.error).toBe(
				"Nenhuma conta do Instagram está conectada ao portal.",
			);
		});
	});

	it("respeita o teto da rodada — a cota da Meta não volta", async () => {
		conectar("INSTAGRAM");
		for (let index = 0; index < 5; index += 1) {
			const post = SocialPost.draft({
				id: `post-${index}`,
				origin: "MANUAL",
				captionText: "oi",
				mediaIds: ["m-1"],
				platforms: ["INSTAGRAM"],
				createdAt: AGORA,
			}).unwrap();
			post.approve("editor-1", AGORA);
			await repo.save(post);
		}

		const resultado = await publishPendingPosts(deps, 2);

		expect(resultado.posts).toBe(2);
		expect(publisher.requests).toHaveLength(2);
	});

	it("fila vazia não faz nada e não quebra", async () => {
		expect(await publishPendingPosts(deps)).toEqual({
			posts: 0,
			published: 0,
			failed: 0,
			retrying: 0,
		});
	});
});
