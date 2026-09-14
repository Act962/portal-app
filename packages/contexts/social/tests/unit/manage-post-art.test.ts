import {
	ArtTemplate,
	choosePostArt,
	DEFAULT_TEXT_STYLE,
	SocialPost,
	setPostArtContent,
	setPostArtOverrides,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

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
	it("o EDITOR escolhe o padrão de um destino, e o post guarda a cópia", async () => {
		const post = (
			await choosePostArt(
				editor,
				{
					id: "post-1",
					destination: "INSTAGRAM",
					templateId: "feed",
					overrides: { titulo: "Título da arte" },
				},
				deps(),
			)
		).unwrap();

		expect(post.artFor("INSTAGRAM")).toMatchObject({
			templateId: "feed",
			version: 1,
			overrides: { titulo: "Título da arte" },
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

describe("setPostArtOverrides", () => {
	it("troca os textos e MANTÉM a cópia — mesmo com o padrão editado depois (D9)", async () => {
		await choosePostArt(
			editor,
			{ id: "post-1", destination: "INSTAGRAM", templateId: "feed" },
			deps(),
		);
		const feed = await templates.findById("feed");
		feed?.update({ name: "Renomeado", layers: [] }, AGORA);

		const post = (
			await setPostArtOverrides(
				editor,
				{
					id: "post-1",
					destination: "INSTAGRAM",
					overrides: { titulo: "Corrigido" },
				},
				deps(),
			)
		).unwrap();

		const arte = post.artFor("INSTAGRAM");
		expect(arte?.overrides).toEqual({ titulo: "Corrigido" });
		expect(arte?.version).toBe(1);
		expect(arte?.templateName).toBe("Padrão feed");
		expect(arte?.layers).toHaveLength(1);
	});

	it("destino sem arte, post inexistente ou sem permissão", async () => {
		const pedido = {
			id: "post-1",
			destination: "INSTAGRAM" as const,
			overrides: {},
		};
		expect(
			(await setPostArtOverrides(editor, pedido, deps())).unwrapErr().message,
		).toContain("ainda não tem um padrão");
		expect(
			(
				await setPostArtOverrides(editor, { ...pedido, id: "nada" }, deps())
			).unwrapErr().name,
		).toBe("SocialPostNotFound");
		expect(
			(await setPostArtOverrides(staff("REDATOR"), pedido, deps())).unwrapErr()
				.name,
		).toBe("Forbidden");
	});
});

describe("setPostArtContent", () => {
	const conteudo = {
		headline: "Chuva alaga o centro de Piracuruca",
		kicker: "Plantão",
		sectionName: "Cidades",
	};

	it("troca o conteúdo das caixas no rascunho", async () => {
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
