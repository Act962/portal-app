import { describe, expect, it } from "vitest";

import { Folder, MissingFolderName } from "../../src/index";

describe("Folder.create", () => {
	it("cria com id e nome", () => {
		const folder = Folder.create({ id: "f-1", name: "Eleições 2026" }).unwrap();

		expect(folder.id).toBe("f-1");
		expect(folder.name).toBe("Eleições 2026");
	});

	// O nome é o que o editor lê na tela; espaço nas pontas vira pasta que
	// parece duplicada ("Esportes" e "Esportes ") e não ordena junto.
	it("apara espaços das pontas", () => {
		expect(
			Folder.create({ id: "f-1", name: "  Esportes  " }).unwrap().name,
		).toBe("Esportes");
	});

	it.each(["", "   ", "\t\n"])("recusa nome vazio: %j", (name) => {
		expect(Folder.create({ id: "f-1", name }).unwrapErr()).toBeInstanceOf(
			MissingFolderName,
		);
	});
});

describe("Folder.rename", () => {
	it("troca o nome", () => {
		const folder = Folder.create({ id: "f-1", name: "Antigo" }).unwrap();

		expect(folder.rename("Novo").isOk()).toBe(true);
		expect(folder.name).toBe("Novo");
	});

	it("apara na renomeação também", () => {
		const folder = Folder.create({ id: "f-1", name: "Antigo" }).unwrap();
		folder.rename("  Novo  ");

		expect(folder.name).toBe("Novo");
	});

	// Renomear para vazio não pode "limpar" o nome: a pasta ficaria sem
	// identidade na tela, impossível de escolher e impossível de apagar.
	it("recusa nome vazio e PRESERVA o anterior", () => {
		const folder = Folder.create({ id: "f-1", name: "Antigo" }).unwrap();

		expect(folder.rename("  ").unwrapErr()).toBeInstanceOf(MissingFolderName);
		expect(folder.name).toBe("Antigo");
	});
});

describe("Folder.restore", () => {
	it("reidrata sem revalidar", () => {
		const folder = Folder.restore({ id: "f-9", name: "Do banco" });

		expect(folder.id).toBe("f-9");
		expect(folder.name).toBe("Do banco");
	});
});
