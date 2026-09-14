import { newPrismaClient } from "@portal-app/db/client";
import {
	ArtTemplate,
	DEFAULT_TEXT_STYLE,
	EMPTY_DESIGN,
} from "@portal-app/social";
import { PrismaArtTemplateRepository } from "@portal-app/social/infrastructure/prisma-art-template-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

import {
	design,
	foto,
	moldura,
	texto,
	tituloEditavel,
	variavel,
} from "../unit/art-fixtures";

const prisma = newPrismaClient(inject("databaseUrl"));
const repo = new PrismaArtTemplateRepository(prisma);

afterAll(async () => {
	await prisma.$disconnect();
});

beforeEach(async () => {
	await prisma.socialArtTemplate.deleteMany();
});

const CRIADO = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T13:00:00Z");

const desenho = design(
	[
		foto(),
		moldura(),
		texto("chapeu", "{{chapeu}}", {
			style: {
				...DEFAULT_TEXT_STYLE,
				color: "#d9232e",
				background: {
					color: "#ffffff",
					radius: 32,
					paddingX: 24,
					paddingY: 8,
					shape: "hug",
				},
			},
		}),
		tituloEditavel(),
		texto("botao", "{{chamada}}"),
	],
	[variavel("chamada", "MATÉRIA COMPLETA NOS STORIES")],
);

function padrao(id: string, name: string, format: "4:5" | "9:16" = "4:5") {
	return ArtTemplate.create({
		id,
		name,
		format,
		design: format === "4:5" ? desenho : EMPTY_DESIGN,
		createdAt: CRIADO,
	}).unwrap();
}

describe("PrismaArtTemplateRepository", () => {
	it("guarda e devolve o padrão inteiro — desenho, variáveis, versão e datas", async () => {
		const original = padrao("tpl-1", "Últimas");
		original.update({ name: "Últimas — feed" }, DEPOIS);
		await repo.save(original);

		const lido = await repo.findById("tpl-1");

		expect(lido?.name).toBe("Últimas — feed");
		expect(lido?.format).toBe("4:5");
		expect(lido?.version).toBe(2);
		expect(lido?.design).toEqual(desenho);
		expect(lido?.createdAt).toEqual(CRIADO);
		expect(lido?.updatedAt).toEqual(DEPOIS);
		expect(await repo.findById("nada")).toBeNull();
	});

	it("regravar atualiza em vez de duplicar", async () => {
		const template = padrao("tpl-1", "Últimas");
		await repo.save(template);
		template.update({ design: EMPTY_DESIGN }, DEPOIS);
		await repo.save(template);

		expect(await prisma.socialArtTemplate.count()).toBe(1);
		expect((await repo.findById("tpl-1"))?.design).toEqual(EMPTY_DESIGN);
	});

	it("linha com a coluna no default ({}) volta com o desenho vazio", async () => {
		await prisma.socialArtTemplate.create({
			data: { id: "cru", name: "Cru", format: "1:1" },
		});
		expect((await repo.findById("cru"))?.design).toEqual(EMPTY_DESIGN);
	});

	it("lista por nome, sem os arquivados, e filtra por formato", async () => {
		const plantao = padrao("tpl-2", "Plantão");
		const arquivado = padrao("tpl-3", "Antigo");
		arquivado.archive(DEPOIS);
		await repo.saveAll([
			padrao("tpl-1", "Últimas"),
			plantao,
			arquivado,
			padrao("tpl-4", "Stories", "9:16"),
		]);

		expect((await repo.list({})).map((t) => t.name)).toEqual([
			"Plantão",
			"Stories",
			"Últimas",
		]);
		expect(await repo.list({ includeArchived: true })).toHaveLength(4);
		expect((await repo.list({ format: "9:16" })).map((t) => t.id)).toEqual([
			"tpl-4",
		]);
	});

	it("acha o padrão de um destino, ignorando o arquivado", async () => {
		const feed = padrao("tpl-1", "Feed");
		feed.setDefaultFor(["INSTAGRAM", "FACEBOOK"], CRIADO);
		const stories = padrao("tpl-2", "Stories", "9:16");
		stories.setDefaultFor(["INSTAGRAM_STORIES"], CRIADO);
		await repo.saveAll([feed, stories]);

		expect((await repo.findDefaultFor("FACEBOOK"))?.id).toBe("tpl-1");
		expect((await repo.findDefaultFor("INSTAGRAM_STORIES"))?.id).toBe("tpl-2");

		stories.archive(DEPOIS);
		await repo.save(stories);
		expect(await repo.findDefaultFor("INSTAGRAM_STORIES")).toBeNull();
	});

	it("responde se uma mídia é usada por algum padrão — arquivado inclusive", async () => {
		const template = padrao("tpl-1", "Últimas");
		template.archive(DEPOIS);
		await repo.save(template);

		expect(await repo.usesMedia("media-moldura")).toBe(true);
		expect(await repo.usesMedia("outra")).toBe(false);
	});
});
