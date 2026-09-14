import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	draftPostForArticle,
	type PublishedArticle,
	prepareArticlePost,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import {
	InMemoryArtTemplateRepository,
	InMemorySocialPostRepository,
	staff,
} from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

const MATERIA: PublishedArticle = {
	id: "art-1",
	headline: "Estudantes de Piracuruca são premiados na OBMEP",
	kicker: "Últimas",
	standfirst: "Resultado destaca o avanço da educação.",
	sectionName: "Educação",
	authorName: "Redação",
	tags: [],
	url: "https://portal7cidades.com.br/educacao/obmep",
	siteName: "Portal 7 Cidades",
	coverMediaId: "capa-1",
};

function padrao(id: string, format: "4:5" | "9:16") {
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

let repo: InMemorySocialPostRepository;
let templates: InMemoryArtTemplateRepository;
const editor = staff("EDITOR");

const deps = () => ({
	repo,
	templates,
	clock: new FixedClock(AGORA),
	ids: new SequentialIdGenerator("post"),
});

beforeEach(async () => {
	repo = new InMemorySocialPostRepository();
	templates = new InMemoryArtTemplateRepository();
	const feed = padrao("feed", "4:5");
	feed.setDefaultFor(["INSTAGRAM"], AGORA);
	const stories = padrao("stories", "9:16");
	stories.setDefaultFor(["INSTAGRAM_STORIES"], AGORA);
	await templates.saveAll([feed, stories, padrao("outro-feed", "4:5")]);
});

const pedido = (overrides = {}) => ({
	article: MATERIA,
	articlePublished: true,
	destinations: ["INSTAGRAM", "INSTAGRAM_STORIES"] as const,
	approve: false,
	...overrides,
});

describe("prepareArticlePost (spec 09, F6)", () => {
	it("cria o post DA matéria em rascunho, com o padrão de cada destino", async () => {
		const post = (await prepareArticlePost(editor, pedido(), deps())).unwrap();

		expect(post.origin).toBe("MATERIA");
		expect(post.status).toBe("RASCUNHO");
		expect(post.articleId).toBe("art-1");
		expect(post.mediaIds).toEqual(["capa-1"]);
		expect(post.linkUrl).toBe(MATERIA.url);
		expect(post.artFor("INSTAGRAM")?.templateId).toBe("feed");
		expect(post.artFor("INSTAGRAM_STORIES")?.templateId).toBe("stories");
		expect(post.artContent).toEqual({
			headline: MATERIA.headline,
			kicker: "Últimas",
			sectionName: "Educação",
		});
		expect(repo.posts.size).toBe(1);
	});

	it("respeita o padrão escolhido e o 'sem padrão'", async () => {
		const post = (
			await prepareArticlePost(
				editor,
				pedido({
					templates: { INSTAGRAM: "outro-feed", INSTAGRAM_STORIES: null },
				}),
				deps(),
			)
		).unwrap();
		expect(post.artFor("INSTAGRAM")?.templateId).toBe("outro-feed");
		expect(post.artFor("INSTAGRAM_STORIES")).toBeNull();
	});

	it("aprovar já põe o post a caminho", async () => {
		const post = (
			await prepareArticlePost(editor, pedido({ approve: true }), deps())
		).unwrap();
		expect(post.status).toBe("PUBLICANDO");
		expect(post.approvedByStaffId).toBe(editor.id);
	});

	it("NÃO aprova com a matéria fora do ar — e não grava nada", async () => {
		const erro = (
			await prepareArticlePost(
				editor,
				pedido({ approve: true, articlePublished: false }),
				deps(),
			)
		).unwrapErr();
		expect(erro.name).toBe("ArticleNotPublished");
		expect(erro.message).toContain("rascunho");
		expect(repo.posts.size).toBe(0);
	});

	it("com a matéria fora do ar, rascunho vale", async () => {
		const post = (
			await prepareArticlePost(
				editor,
				pedido({ articlePublished: false }),
				deps(),
			)
		).unwrap();
		expect(post.status).toBe("RASCUNHO");
	});

	it("reaproveita o rascunho automático — nunca dois posts da mesma matéria", async () => {
		const automatico = await draftPostForArticle(MATERIA, {
			repo,
			clock: new FixedClock(AGORA),
			ids: new SequentialIdGenerator("auto"),
			platforms: ["INSTAGRAM", "FACEBOOK"],
		});
		automatico?.edit({ captionText: "Legenda revisada na fila" });

		const post = (
			await prepareArticlePost(
				editor,
				pedido({ destinations: ["INSTAGRAM", "INSTAGRAM_STORIES"] }),
				deps(),
			)
		).unwrap();

		expect(post.id).toBe(automatico?.id);
		expect(repo.posts.size).toBe(1);
		// A legenda revisada fica; mudam os destinos e a arte.
		expect(post.caption.value).toBe("Legenda revisada na fila");
		expect(post.targets).toEqual(["INSTAGRAM", "INSTAGRAM_STORIES"]);
		expect(post.artFor("INSTAGRAM_STORIES")?.templateId).toBe("stories");
	});

	it("o post preparado na matéria trava o gatilho automático", async () => {
		await prepareArticlePost(editor, pedido(), deps());
		const automatico = await draftPostForArticle(MATERIA, {
			repo,
			clock: new FixedClock(AGORA),
			ids: new SequentialIdGenerator("auto"),
			platforms: ["INSTAGRAM"],
		});
		expect(automatico).toBeNull();
		expect(repo.posts.size).toBe(1);
	});

	it("post da matéria já aprovado não é mexido", async () => {
		await prepareArticlePost(editor, pedido({ approve: true }), deps());
		const erro = (
			await prepareArticlePost(editor, pedido(), deps())
		).unwrapErr();
		expect(erro.name).toBe("InvalidPostTransition");
	});

	it("recusa padrão inexistente, arquivado ou de formato errado", async () => {
		expect(
			(
				await prepareArticlePost(
					editor,
					pedido({ templates: { INSTAGRAM: "nada" } }),
					deps(),
				)
			).unwrapErr().name,
		).toBe("ArtTemplateNotFound");

		const velho = padrao("velho", "4:5");
		velho.archive(AGORA);
		await templates.save(velho);
		expect(
			(
				await prepareArticlePost(
					editor,
					pedido({ templates: { INSTAGRAM: "velho" } }),
					deps(),
				)
			).unwrapErr().message,
		).toContain("arquivado");

		const formato = (
			await prepareArticlePost(
				editor,
				pedido({ templates: { INSTAGRAM_STORIES: "feed" } }),
				deps(),
			)
		).unwrapErr();
		expect(formato.name).toBe("InvalidArtChoice");
		expect(formato.message).toBe(
			'O padrão "Padrão feed" é 4:5, e Stories do Instagram pede 9:16.',
		);
		expect(repo.posts.size).toBe(0);
	});

	it("o REDATOR não prepara", async () => {
		expect(
			(await prepareArticlePost(staff("REDATOR"), pedido(), deps())).unwrapErr()
				.name,
		).toBe("Forbidden");
	});
});
