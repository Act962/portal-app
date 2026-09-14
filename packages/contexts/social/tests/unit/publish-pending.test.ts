import { FixedClock } from "@portal-app/shared-kernel";
import {
	MAX_AUTOMATIC_ATTEMPTS,
	publishPendingPosts,
	SocialAccount,
	type SocialPlatform,
	SocialPost,
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
