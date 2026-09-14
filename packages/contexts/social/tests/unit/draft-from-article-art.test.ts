import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	ArtTemplate,
	draftPostForArticle,
	EMPTY_DESIGN,
	type PublishedArticle,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import { design, tituloEditavel } from "./art-fixtures";
import {
	InMemoryArtTemplateRepository,
	InMemorySocialPostRepository,
} from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

const MATERIA: PublishedArticle = {
	id: "art-1",
	headline: "Estudantes de Piracuruca são premiados na OBMEP",
	kicker: "  Últimas ",
	standfirst: "Resultado destaca o avanço da educação no município.",
	sectionName: "Educação",
	authorName: "Redação",
	tags: ["OBMEP"],
	url: "https://portal7cidades.com.br/educacao/obmep",
	siteName: "Portal 7 Cidades",
	coverMediaId: "capa-1",
};

function padrao(id: string, format: "4:5" | "9:16") {
	return ArtTemplate.create({
		id,
		name: `Padrão ${format}`,
		format,
		design: design([tituloEditavel()]),
		createdAt: AGORA,
	}).unwrap();
}

let repo: InMemorySocialPostRepository;
let templates: InMemoryArtTemplateRepository;

beforeEach(() => {
	repo = new InMemorySocialPostRepository();
	templates = new InMemoryArtTemplateRepository();
});

const deps = (withTemplates = true) => ({
	repo,
	clock: new FixedClock(AGORA),
	ids: new SequentialIdGenerator("post"),
	platforms: ["INSTAGRAM", "INSTAGRAM_STORIES", "FACEBOOK"] as const,
	...(withTemplates ? { templates } : {}),
});

describe("rascunho automático com os padrões de destino (spec 09, D2)", () => {
	it("cada destino com padrão nasce com a cópia do desenho; sem padrão, sem arte", async () => {
		const feed = padrao("tpl-feed", "4:5");
		feed.setDefaultFor(["INSTAGRAM"], AGORA);
		const stories = padrao("tpl-stories", "9:16");
		stories.setDefaultFor(["INSTAGRAM_STORIES"], AGORA);
		await templates.saveAll([feed, stories]);

		const post = await draftPostForArticle(MATERIA, deps());

		expect(post?.artFor("INSTAGRAM")?.templateId).toBe("tpl-feed");
		expect(post?.artFor("INSTAGRAM_STORIES")?.templateId).toBe("tpl-stories");
		expect(post?.artFor("FACEBOOK")).toBeNull();
	});

	it("guarda o que as variáveis do sistema usam, limpo, com a data do preparo", async () => {
		const post = await draftPostForArticle(MATERIA, deps());
		expect(post?.artContent).toEqual({
			headline: "Estudantes de Piracuruca são premiados na OBMEP",
			subtitle: "Resultado destaca o avanço da educação no município.",
			kicker: "Últimas",
			sectionName: "Educação",
			authorName: "Redação",
			siteName: "Portal 7 Cidades",
			date: "2026-09-14T12:00:00.000Z",
		});
	});

	it("chapéu em branco vira ausência de chapéu", async () => {
		const post = await draftPostForArticle(
			{ ...MATERIA, kicker: "   " },
			deps(),
		);
		expect(post?.artContent?.kicker).toBeNull();
	});

	it("padrão arquivado não é aplicado", async () => {
		const feed = padrao("tpl-feed", "4:5");
		feed.setDefaultFor(["INSTAGRAM"], AGORA);
		feed.archive(AGORA);
		await templates.save(feed);

		const post = await draftPostForArticle(MATERIA, deps());

		expect(post?.artFor("INSTAGRAM")).toBeNull();
	});

	it("sem repositório de padrões, o rascunho nasce sem arte — como antes", async () => {
		const post = await draftPostForArticle(MATERIA, deps(false));
		expect(post?.artSelections).toEqual({});
		expect(post?.artContent?.headline).toBe(MATERIA.headline);
	});

	it("editar o padrão depois NÃO muda a arte do rascunho já criado (D9)", async () => {
		const feed = padrao("tpl-feed", "4:5");
		feed.setDefaultFor(["INSTAGRAM"], AGORA);
		await templates.save(feed);
		const post = await draftPostForArticle(MATERIA, deps());

		feed.update({ design: EMPTY_DESIGN }, AGORA);

		expect(feed.version).toBe(2);
		expect(post?.artFor("INSTAGRAM")?.version).toBe(1);
		expect(post?.artFor("INSTAGRAM")?.design.elements).toHaveLength(1);
	});
});
