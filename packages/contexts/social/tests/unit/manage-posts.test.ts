import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	approvePost,
	cancelPost,
	confirmManualPublish,
	countPendingPosts,
	createDraft,
	dismissDelivery,
	getPost,
	listQueue,
	publishDeliveryManually,
	retryPost,
	updatePost,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemorySocialPostRepository, staff } from "./doubles";

const AGORA = new Date("2026-09-11T12:00:00Z");

let repo: InMemorySocialPostRepository;
let deps: {
	repo: InMemorySocialPostRepository;
	clock: FixedClock;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	repo = new InMemorySocialPostRepository();
	deps = {
		repo,
		clock: new FixedClock(AGORA),
		ids: new SequentialIdGenerator("post"),
	};
});

const entrada = {
	captionText: "Chuva alaga o centro #Piracuruca",
	mediaIds: ["media-1"],
	platforms: ["INSTAGRAM", "FACEBOOK"] as const,
	linkUrl: "https://fm7cidades.com/cidades/chuva",
};

describe("autorização (D11)", () => {
	it("o EDITOR aprova — senão a fila para quando o admin não está on-line", async () => {
		const editor = staff("EDITOR");
		const rascunho = (await createDraft(editor, entrada, deps)).unwrap();
		const post = (
			await approvePost(editor, { id: rascunho.id }, deps)
		).unwrap();
		expect(post.status).toBe("PUBLICANDO");
		expect(post.approvedByStaffId).toBe(editor.id);
	});

	it("o REDATOR não cria nem aprova", async () => {
		const redator = staff("REDATOR");
		expect((await createDraft(redator, entrada, deps)).unwrapErr().name).toBe(
			"Forbidden",
		);
		expect(
			(await approvePost(redator, { id: "seja-qual-for" }, deps)).unwrapErr()
				.name,
		).toBe("Forbidden");
	});

	it("a permissão é checada ANTES de ir ao banco", async () => {
		// Não é detalhe: checar depois vazaria a existência (ou não) de um post
		// para quem não pode vê-lo, pela diferença entre NOT_FOUND e FORBIDDEN.
		await approvePost(staff("REDATOR"), { id: "nao-existe" }, deps);
		expect(repo.posts.size).toBe(0);
	});
});

describe("createDraft", () => {
	it("grava o rascunho como MANUAL e devolve o post", async () => {
		const post = (await createDraft(staff("ADMIN"), entrada, deps)).unwrap();
		expect(post.origin).toBe("MANUAL");
		expect(post.status).toBe("RASCUNHO");
		expect(repo.posts.get(post.id)).toBe(post);
	});

	it("propaga o erro de domínio sem gravar nada", async () => {
		const erro = (
			await createDraft(staff("ADMIN"), { ...entrada, captionText: " " }, deps)
		).unwrapErr();
		expect(erro.name).toBe("CaptionRequired");
		expect(repo.posts.size).toBe(0);
	});
});

describe("operações sobre post inexistente", () => {
	it("todas respondem SocialPostNotFound, e não um erro genérico", async () => {
		const admin = staff("ADMIN");
		const id = "fantasma";
		for (const result of [
			await updatePost(admin, { id, captionText: "x" }, deps),
			await approvePost(admin, { id }, deps),
			await retryPost(admin, { id }, deps),
			await cancelPost(admin, { id }, deps),
		]) {
			expect(result.unwrapErr().name).toBe("SocialPostNotFound");
		}
	});
});

describe("approvePost", () => {
	it("tranca o post e registra quem aprovou", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();
		const post = (await approvePost(admin, { id: rascunho.id }, deps)).unwrap();
		expect(post.status).toBe("PUBLICANDO");
		expect(post.approvedByStaffId).toBe(admin.id);
		expect(post.approvedAt).toEqual(AGORA);
	});

	it("a segunda aprovação vira erro de transição — o segundo clique", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();
		await approvePost(admin, { id: rascunho.id }, deps);
		const erro = (
			await approvePost(admin, { id: rascunho.id }, deps)
		).unwrapErr();
		expect(erro.name).toBe("InvalidPostTransition");
	});

	it("post incompleto é recusado com a lista do que falta", async () => {
		const admin = staff("ADMIN");
		const rascunho = (
			await createDraft(admin, { ...entrada, mediaIds: [] }, deps)
		).unwrap();
		const erro = (
			await approvePost(admin, { id: rascunho.id }, deps)
		).unwrapErr();
		expect(erro.name).toBe("PostNotReady");
		expect((erro as { blockers: string[] }).blockers[0]).toContain("imagem");
	});
});

describe("updatePost e cancelPost", () => {
	it("editam e descartam o rascunho", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();

		const editado = (
			await updatePost(
				admin,
				{ id: rascunho.id, captionText: "Outra legenda" },
				deps,
			)
		).unwrap();
		expect(editado.caption.value).toBe("Outra legenda");

		const cancelado = (
			await cancelPost(admin, { id: rascunho.id }, deps)
		).unwrap();
		expect(cancelado.status).toBe("CANCELADA");
	});

	it("recusa editar o que já foi aprovado", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();
		await approvePost(admin, { id: rascunho.id }, deps);
		const erro = (
			await updatePost(admin, { id: rascunho.id, captionText: "tarde" }, deps)
		).unwrapErr();
		expect(erro.name).toBe("InvalidPostTransition");
	});
});

describe("retryPost", () => {
	it("recusa em rascunho — não há o que reenviar", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();
		expect((await retryPost(admin, { id: rascunho.id }, deps)).isErr()).toBe(
			true,
		);
	});

	it("recoloca na fila só o que falhou", async () => {
		const admin = staff("ADMIN");
		const rascunho = (await createDraft(admin, entrada, deps)).unwrap();
		await approvePost(admin, { id: rascunho.id }, deps);
		rascunho.recordSuccess("FACEBOOK", "fb-1", null, AGORA);
		rascunho.recordFailure("INSTAGRAM", "imagem inválida", AGORA);

		const post = (await retryPost(admin, { id: rascunho.id }, deps)).unwrap();
		expect(post.pendingDeliveries().map((d) => d.destination)).toEqual([
			"INSTAGRAM",
		]);
		expect(post.deliveryFor("FACEBOOK")?.remoteId).toBe("fb-1");
	});
});

describe("leituras", () => {
	it("a fila filtra por status e pagina", async () => {
		const admin = staff("ADMIN");
		const primeiro = (await createDraft(admin, entrada, deps)).unwrap();
		await createDraft(admin, entrada, deps);
		await approvePost(admin, { id: primeiro.id }, deps);

		const rascunhos = await listQueue(
			{ status: "RASCUNHO" },
			{ limit: 10, offset: 0 },
			deps,
		);
		expect(rascunhos.total).toBe(1);
		expect(await countPendingPosts(deps)).toBe(1);
	});

	it("getPost devolve null quando não existe, em vez de lançar", async () => {
		expect(await getPost("nada", deps)).toBeNull();
	});
});

describe("publicação manual (spec 11)", () => {
	async function storyEsperando() {
		const post = (
			await createDraft(
				staff("EDITOR"),
				{ ...entrada, platforms: ["INSTAGRAM_STORIES"] },
				deps,
			)
		).unwrap();
		post.approve("editor-1", AGORA);
		post.recordPrepared("INSTAGRAM_STORIES", "https://cdn.test/a.jpg", AGORA);
		await repo.save(post);
		return post;
	}

	it("o post nasce com os modos pedidos", async () => {
		const post = (
			await createDraft(
				staff("EDITOR"),
				{
					...entrada,
					platforms: ["INSTAGRAM_STORIES"],
					modes: { INSTAGRAM_STORIES: "AUTOMATICO" },
				},
				deps,
			)
		).unwrap();
		expect(post.deliveryFor("INSTAGRAM_STORIES")?.mode).toBe("AUTOMATICO");
	});

	it("'Já publiquei' grava quem publicou e o link aparado; vazio vira nulo", async () => {
		const post = await storyEsperando();

		const feito = await confirmManualPublish(
			staff("EDITOR", "editor-7"),
			{ id: post.id, destination: "INSTAGRAM_STORIES", permalink: "  " },
			deps,
		);

		const story = feito.unwrap().deliveryFor("INSTAGRAM_STORIES");
		expect(story?.publishedByStaffId).toBe("editor-7");
		expect(story?.permalink).toBeNull();
	});

	it("dispensar e publicar à mão também gravam; o que está no estado errado é recusado", async () => {
		const post = await storyEsperando();
		expect(
			(
				await publishDeliveryManually(
					staff("EDITOR"),
					{ id: post.id, destination: "INSTAGRAM_STORIES" },
					deps,
				)
			).isErr(),
		).toBe(true);

		const dispensado = await dismissDelivery(
			staff("EDITOR"),
			{ id: post.id, destination: "INSTAGRAM_STORIES" },
			deps,
		);
		expect(dispensado.unwrap().status).toBe("CANCELADA");
	});

	it("sem social:publish é Forbidden; post inexistente, NotFound", async () => {
		const post = await storyEsperando();
		const semPermissao = await confirmManualPublish(
			staff("REDATOR"),
			{ id: post.id, destination: "INSTAGRAM_STORIES" },
			deps,
		);
		expect(semPermissao.unwrapErr().name).toBe("Forbidden");

		const inexistente = await dismissDelivery(
			staff("EDITOR"),
			{ id: "nada", destination: "INSTAGRAM_STORIES" },
			deps,
		);
		expect(inexistente.unwrapErr().name).toBe("SocialPostNotFound");
	});

	it("o badge conta o que espera aprovação E o que espera alguém publicar", async () => {
		await storyEsperando();
		await createDraft(staff("EDITOR"), entrada, deps);
		expect(await countPendingPosts(deps)).toBe(2);
	});
});
