import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	archiveTemplate,
	createTemplate,
	defaultTemplateFor,
	duplicateTemplate,
	getTemplate,
	listTemplates,
	setTemplateDefaults,
	updateTemplate,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import { design, moldura, tituloEditavel } from "./art-fixtures";
import { InMemoryArtTemplateRepository, staff } from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

let templates: InMemoryArtTemplateRepository;
let deps: {
	templates: InMemoryArtTemplateRepository;
	clock: FixedClock;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	templates = new InMemoryArtTemplateRepository();
	deps = {
		templates,
		clock: new FixedClock(AGORA),
		ids: new SequentialIdGenerator("tpl"),
	};
});

const admin = staff("ADMIN");
const editor = staff("EDITOR");

const completo = design([moldura(), tituloEditavel()]);
const soTitulo = design([tituloEditavel()]);

async function criar(name = "Últimas", format: "1:1" | "4:5" | "9:16" = "4:5") {
	return (
		await createTemplate(admin, { name, format, design: completo }, deps)
	).unwrap();
}

describe("autorização", () => {
	it("o EDITOR vê e escolhe padrões, mas não cria nem muda", async () => {
		const padrao = await criar();
		expect((await listTemplates(editor, {}, deps)).unwrap()).toHaveLength(1);
		expect((await getTemplate(editor, { id: padrao.id }, deps)).isOk()).toBe(
			true,
		);

		const negado = "Forbidden";
		expect(
			(
				await createTemplate(editor, { name: "x", format: "1:1" }, deps)
			).unwrapErr().name,
		).toBe(negado);
		expect(
			(
				await updateTemplate(editor, { id: padrao.id, name: "y" }, deps)
			).unwrapErr().name,
		).toBe(negado);
		expect(
			(await duplicateTemplate(editor, { id: padrao.id }, deps)).unwrapErr()
				.name,
		).toBe(negado);
		expect(
			(
				await setTemplateDefaults(
					editor,
					{ id: padrao.id, destinations: ["INSTAGRAM"] },
					deps,
				)
			).unwrapErr().name,
		).toBe(negado);
		expect(
			(await archiveTemplate(editor, { id: padrao.id }, deps)).unwrapErr().name,
		).toBe(negado);
	});

	it("o REDATOR nem vê", async () => {
		const redator = staff("REDATOR");
		expect((await listTemplates(redator, {}, deps)).unwrapErr().name).toBe(
			"Forbidden",
		);
		expect(
			(await getTemplate(redator, { id: "x" }, deps)).unwrapErr().name,
		).toBe("Forbidden");
	});
});

describe("criar e editar", () => {
	it("cria com id novo e grava", async () => {
		const padrao = await criar();
		expect(padrao.id).toBe("tpl-1");
		expect(templates.templates.get("tpl-1")?.name).toBe("Últimas");
	});

	it("padrão inválido não é gravado", async () => {
		const erro = (
			await createTemplate(admin, { name: "", format: "4:5" }, deps)
		).unwrapErr();
		expect(erro.name).toBe("InvalidArtTemplate");
		expect(templates.templates.size).toBe(0);
	});

	it("editar sobe a versão", async () => {
		const padrao = await criar();
		const editado = (
			await updateTemplate(admin, { id: padrao.id, design: soTitulo }, deps)
		).unwrap();
		expect(editado.version).toBe(2);
		expect(editado.design).toEqual(soTitulo);
	});

	it("editar inexistente, inválido ou arquivado é recusado", async () => {
		expect(
			(await updateTemplate(admin, { id: "nada" }, deps)).unwrapErr().name,
		).toBe("ArtTemplateNotFound");

		const padrao = await criar();
		expect(
			(
				await updateTemplate(admin, { id: padrao.id, name: " " }, deps)
			).unwrapErr().name,
		).toBe("InvalidArtTemplate");

		await archiveTemplate(admin, { id: padrao.id }, deps);
		const erro = (
			await updateTemplate(admin, { id: padrao.id, name: "Outro" }, deps)
		).unwrapErr();
		expect(erro.message).toContain("arquivado");
	});

	it("getTemplate de id que não existe", async () => {
		expect(
			(await getTemplate(admin, { id: "nada" }, deps)).unwrapErr().name,
		).toBe("ArtTemplateNotFound");
	});
});

describe("duplicar", () => {
	it("copia o desenho num padrão novo, na versão 1 e sem ser padrão de nada", async () => {
		const original = await criar();
		await updateTemplate(admin, { id: original.id, name: "Últimas" }, deps);
		await setTemplateDefaults(
			admin,
			{ id: original.id, destinations: ["INSTAGRAM"] },
			deps,
		);

		const copia = (
			await duplicateTemplate(admin, { id: original.id }, deps)
		).unwrap();

		expect(copia.id).not.toBe(original.id);
		expect(copia.name).toBe("Últimas (cópia)");
		expect(copia.version).toBe(1);
		expect(copia.defaultFor).toEqual([]);
		expect(copia.design).toEqual(original.design);
	});

	it("nome longo é cortado para caber o sufixo; nome dado é usado", async () => {
		const original = await criar("a".repeat(60));
		const copia = (
			await duplicateTemplate(admin, { id: original.id }, deps)
		).unwrap();
		expect([...copia.name].length).toBe(60);
		expect(copia.name.endsWith(" (cópia)")).toBe(true);

		const nomeada = (
			await duplicateTemplate(admin, { id: original.id, name: "Stories" }, deps)
		).unwrap();
		expect(nomeada.name).toBe("Stories");
	});

	it("duplicar inexistente", async () => {
		expect(
			(await duplicateTemplate(admin, { id: "nada" }, deps)).unwrapErr().name,
		).toBe("ArtTemplateNotFound");
	});

	it("o arquivado pode ser duplicado — é o caminho de volta", async () => {
		const original = await criar();
		await archiveTemplate(admin, { id: original.id }, deps);
		expect(
			(await duplicateTemplate(admin, { id: original.id }, deps)).isOk(),
		).toBe(true);
	});
});

describe("padrão de destino (D10)", () => {
	it("marcar um DESMARCA quem era o padrão daquele destino, numa gravação só", async () => {
		const antigo = await criar("Antigo");
		const novo = await criar("Novo");
		await setTemplateDefaults(
			admin,
			{ id: antigo.id, destinations: ["INSTAGRAM", "FACEBOOK"] },
			deps,
		);
		templates.batches = 0;

		await setTemplateDefaults(
			admin,
			{ id: novo.id, destinations: ["INSTAGRAM"] },
			deps,
		);

		expect(antigo.defaultFor).toEqual(["FACEBOOK"]);
		expect(novo.defaultFor).toEqual(["INSTAGRAM"]);
		expect(templates.batches).toBe(1);
		expect((await defaultTemplateFor("INSTAGRAM", deps))?.id).toBe(novo.id);
		expect((await defaultTemplateFor("FACEBOOK", deps))?.id).toBe(antigo.id);
	});

	it("destino incompatível é recusado e ninguém é desmarcado", async () => {
		const feed = await criar("Feed");
		const outro = await criar("Outro");
		await setTemplateDefaults(
			admin,
			{ id: outro.id, destinations: ["INSTAGRAM"] },
			deps,
		);

		const erro = (
			await setTemplateDefaults(
				admin,
				{ id: feed.id, destinations: ["INSTAGRAM", "INSTAGRAM_STORIES"] },
				deps,
			)
		).unwrapErr();

		expect(erro.name).toBe("InvalidArtTemplate");
		expect(outro.defaultFor).toEqual(["INSTAGRAM"]);
	});

	it("inexistente ou arquivado não vira padrão", async () => {
		expect(
			(
				await setTemplateDefaults(admin, { id: "nada", destinations: [] }, deps)
			).unwrapErr().name,
		).toBe("ArtTemplateNotFound");

		const padrao = await criar();
		await archiveTemplate(admin, { id: padrao.id }, deps);
		expect(
			(
				await setTemplateDefaults(
					admin,
					{ id: padrao.id, destinations: ["INSTAGRAM"] },
					deps,
				)
			).isErr(),
		).toBe(true);
	});

	it("Stories pedem padrão 9:16", async () => {
		const stories = await criar("Stories", "9:16");
		expect(
			(
				await setTemplateDefaults(
					admin,
					{ id: stories.id, destinations: ["INSTAGRAM_STORIES"] },
					deps,
				)
			).isOk(),
		).toBe(true);
		expect((await defaultTemplateFor("INSTAGRAM_STORIES", deps))?.id).toBe(
			stories.id,
		);
	});
});

describe("arquivar e listar", () => {
	it("arquivado sai da lista e deixa de ser padrão, mas continua existindo", async () => {
		const padrao = await criar("Últimas");
		await criar("Plantão");
		await setTemplateDefaults(
			admin,
			{ id: padrao.id, destinations: ["INSTAGRAM"] },
			deps,
		);

		const arquivado = (
			await archiveTemplate(admin, { id: padrao.id }, deps)
		).unwrap();

		expect(arquivado.archived).toBe(true);
		expect(
			(await listTemplates(admin, {}, deps)).unwrap().map((t) => t.name),
		).toEqual(["Plantão"]);
		expect(
			(await listTemplates(admin, { includeArchived: true }, deps)).unwrap(),
		).toHaveLength(2);
		expect(await defaultTemplateFor("INSTAGRAM", deps)).toBeNull();
		// A moldura continua "em uso": posts aprovados ainda desenham com ele.
		expect(await templates.usesMedia("media-moldura")).toBe(true);
	});

	it("filtra por formato", async () => {
		await criar("Feed", "4:5");
		await criar("Stories", "9:16");
		expect(
			(await listTemplates(editor, { format: "9:16" }, deps))
				.unwrap()
				.map((t) => t.name),
		).toEqual(["Stories"]);
	});

	it("arquivar inexistente", async () => {
		expect(
			(await archiveTemplate(admin, { id: "nada" }, deps)).unwrapErr().name,
		).toBe("ArtTemplateNotFound");
	});
});
