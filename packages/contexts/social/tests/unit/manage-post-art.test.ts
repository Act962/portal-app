import {
	ArtTemplate,
	choosePostArt,
	EMPTY_DESIGN,
	SocialPost,
	setPostArtContent,
	setPostArtInputs,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import {
	CONTEUDO,
	design,
	texto,
	tituloEditavel,
	variavel,
} from "./art-fixtures";
import {
	InMemoryArtTemplateRepository,
	InMemorySocialPostRepository,
	staff,
} from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

let repo: InMemorySocialPostRepository;
let templates: InMemoryArtTemplateRepository;
const deps = () => ({ repo, templates });

const editor = staff("EDITOR");

function padrao(id: string, format: "4:5" | "9:16" = "4:5") {
	return ArtTemplate.create({
		id,
		name: `Padrão ${id}`,
		format,
		design: design(
			[tituloEditavel(), texto("botao", "{{chamada}}")],
			[variavel("chamada", "Leia")],
		),
		createdAt: AGORA,
	}).unwrap();
}

beforeEach(async () => {
	repo = new InMemorySocialPostRepository();
	templates = new InMemoryArtTemplateRepository();
	await repo.save(
		SocialPost.draft({
			id: "post-1",
			origin: "MANUAL",
			captionText: "Chuva alaga o centro",
			mediaIds: ["m-1"],
			platforms: ["INSTAGRAM", "INSTAGRAM_STORIES"],
			createdAt: AGORA,
		}).unwrap(),
	);
	await templates.saveAll([padrao("feed"), padrao("stories", "9:16")]);
});

describe("choosePostArt", () => {
	it("o EDITOR escolhe o padrão de um destino, e o post guarda a cópia com o preenchido", async () => {
		const post = (
			await choosePostArt(
				editor,
				{
					id: "post-1",
					destination: "INSTAGRAM",
					templateId: "feed",
					values: { chamada: "Leia agora" },
					texts: { titulo: "Título da arte" },
				},
				deps(),
			)
		).unwrap();

		expect(post.artFor("INSTAGRAM")).toMatchObject({
			templateId: "feed",
			version: 1,
			values: { chamada: "Leia agora" },
			texts: { titulo: "Título da arte" },
		});
		expect(
			(await repo.findById("post-1"))?.artFor("INSTAGRAM")?.templateId,
		).toBe("feed");
	});

	it("tira a arte com templateId null", async () => {
		await choosePostArt(
			editor,
			{ id: "post-1", destination: "INSTAGRAM", templateId: "feed" },
			deps(),
		);
		const post = (
			await choosePostArt(
				editor,
				{ id: "post-1", destination: "INSTAGRAM", templateId: null },
				deps(),
			)
		).unwrap();
		expect(post.artFor("INSTAGRAM")).toBeNull();
	});

	it("recusa: sem permissão, post inexistente, padrão inexistente ou arquivado", async () => {
		const pedido = {
			id: "post-1",
			destination: "INSTAGRAM" as const,
			templateId: "feed",
		};
		expect(
			(await choosePostArt(staff("REDATOR"), pedido, deps())).unwrapErr().name,
		).toBe("Forbidden");
		expect(
			(
				await choosePostArt(editor, { ...pedido, id: "nada" }, deps())
			).unwrapErr().name,
		).toBe("SocialPostNotFound");
		expect(
			(
				await choosePostArt(editor, { ...pedido, templateId: "nada" }, deps())
			).unwrapErr().name,
		).toBe("ArtTemplateNotFound");

		const arquivado = padrao("velho");
		arquivado.archive(AGORA);
		await templates.save(arquivado);
		const erro = (
			await choosePostArt(editor, { ...pedido, templateId: "velho" }, deps())
		).unwrapErr();
		expect(erro.name).toBe("InvalidArtChoice");
		expect(erro.message).toContain("arquivado");
	});

	it("formato que não serve ao destino é recusado pelo post", async () => {
		const erro = (
			await choosePostArt(
				editor,
				{ id: "post-1", destination: "INSTAGRAM_STORIES", templateId: "feed" },
				deps(),
			)
		).unwrapErr();
		expect(erro.name).toBe("InvalidArtChoice");
		expect(erro.message).toContain("9:16");
	});
});

describe("setPostArtInputs (spec 10, D3)", () => {
	it("troca o preenchido e MANTÉM a cópia — mesmo com o padrão editado depois (09, D9)", async () => {
		await choosePostArt(
			editor,
			{ id: "post-1", destination: "INSTAGRAM", templateId: "feed" },
			deps(),
		);
		const feed = await templates.findById("feed");
		feed?.update({ name: "Renomeado", design: EMPTY_DESIGN }, AGORA);

		const post = (
			await setPostArtInputs(
				editor,
				{
					id: "post-1",
					destination: "INSTAGRAM",
					values: { chamada: "Leia agora", fantasma: "x" },
					texts: { titulo: "Corrigido", botao: "caixa Dinâmica" },
				},
				deps(),
			)
		).unwrap();

		const arte = post.artFor("INSTAGRAM");
		expect(arte?.values).toEqual({ chamada: "Leia agora" });
		expect(arte?.texts).toEqual({ titulo: "Corrigido" });
		expect(arte?.version).toBe(1);
		expect(arte?.templateName).toBe("Padrão feed");
		expect(arte?.design.elements).toHaveLength(2);
	});

	it("destino sem arte, post inexistente ou sem permissão", async () => {
		const pedido = {
			id: "post-1",
			destination: "INSTAGRAM" as const,
			values: {},
			texts: {},
		};
		expect(
			(await setPostArtInputs(editor, pedido, deps())).unwrapErr().message,
		).toContain("ainda não tem um padrão");
		expect(
			(
				await setPostArtInputs(editor, { ...pedido, id: "nada" }, deps())
			).unwrapErr().name,
		).toBe("SocialPostNotFound");
		expect(
			(await setPostArtInputs(staff("REDATOR"), pedido, deps())).unwrapErr()
				.name,
		).toBe("Forbidden");
	});
});

describe("setPostArtContent", () => {
	const conteudo = {
		...CONTEUDO,
		headline: "Chuva alaga o centro de Piracuruca",
	};

	it("troca o conteúdo das variáveis do sistema no rascunho", async () => {
		const post = (
			await setPostArtContent(
				editor,
				{ id: "post-1", content: conteudo },
				deps(),
			)
		).unwrap();
		expect(post.artContent).toEqual(conteudo);
	});

	it("depois de aprovado, recusa; e também sem post ou permissão", async () => {
		const post = await repo.findById("post-1");
		post?.approve("editor-1", AGORA);

		expect(
			(
				await setPostArtContent(
					editor,
					{ id: "post-1", content: conteudo },
					deps(),
				)
			).unwrapErr().name,
		).toBe("InvalidPostTransition");
		expect(
			(
				await setPostArtContent(
					editor,
					{ id: "nada", content: conteudo },
					deps(),
				)
			).unwrapErr().name,
		).toBe("SocialPostNotFound");
		expect(
			(
				await setPostArtContent(
					staff("REDATOR"),
					{ id: "post-1", content: conteudo },
					deps(),
				)
			).unwrapErr().name,
		).toBe("Forbidden");
	});
});
