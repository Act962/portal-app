import {
	createFolder,
	deleteAsset,
	deleteAssets,
	deleteFolder,
	FolderNameTaken,
	FolderNotEmpty,
	FolderNotFound,
	InMemoryFolderRepository,
	InMemoryMediaRepository,
	InMemoryMediaStorage,
	InMemoryMediaUsage,
	listFolders,
	MediaAssetNotFound,
	MediaInUse,
	MissingFolderName,
	moveAsset,
	moveAssets,
	registerAsset,
	renameFolder,
} from "@portal-app/media";
import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it, vi } from "vitest";

let repo: InMemoryMediaRepository;
let folders: InMemoryFolderRepository;
let storage: InMemoryMediaStorage;
let usage: InMemoryMediaUsage;
let ids: SequentialIdGenerator;

beforeEach(() => {
	repo = new InMemoryMediaRepository();
	folders = new InMemoryFolderRepository();
	storage = new InMemoryMediaStorage();
	usage = new InMemoryMediaUsage();
	ids = new SequentialIdGenerator("media");
});

const imagem = {
	type: "IMAGE" as const,
	filename: "foto.jpg",
	mimeType: "image/jpeg",
	credit: "Foto: Ana",
	altText: "Torcida",
	dimensions: { width: 1600, height: 900 },
};

async function novaImagem(storageKey = "uploads/1/foto.jpg") {
	const result = await registerAsset({ ...imagem, storageKey }, { repo, ids });
	return result.unwrap();
}

describe("createFolder", () => {
	it("cria e passa a listar", async () => {
		const folder = (
			await createFolder({ name: "Eleições 2026" }, { folders, ids })
		).unwrap();

		expect(folder.name).toBe("Eleições 2026");
		expect((await listFolders({ folders })).map((f) => f.name)).toEqual([
			"Eleições 2026",
		]);
	});

	it("recusa nome vazio", async () => {
		expect(
			(await createFolder({ name: "   " }, { folders, ids })).unwrapErr(),
		).toBeInstanceOf(MissingFolderName);
	});

	// Duas pastas com o mesmo nome só se distinguem pelo id, que ninguém vê. O
	// editor guardaria arquivo numa e procuraria na outra.
	it("recusa nome repetido, ignorando caixa e espaços", async () => {
		await createFolder({ name: "Esportes" }, { folders, ids });

		const repetida = await createFolder(
			{ name: "  esportes " },
			{ folders, ids },
		);

		expect(repetida.unwrapErr()).toBeInstanceOf(FolderNameTaken);
		expect(await listFolders({ folders })).toHaveLength(1);
	});
});

describe("renameFolder", () => {
	it("renomeia", async () => {
		const folder = (
			await createFolder({ name: "Antigo" }, { folders, ids })
		).unwrap();

		const result = await renameFolder(
			{ id: folder.id, name: "Novo" },
			{ folders },
		);

		expect(result.unwrap().name).toBe("Novo");
	});

	// Corrigir só a caixa ("esportes" → "Esportes") não pode esbarrar no
	// próprio nome — seria impossível arrumar a capitalização.
	it("deixa corrigir a caixa do próprio nome", async () => {
		const folder = (
			await createFolder({ name: "esportes" }, { folders, ids })
		).unwrap();

		const result = await renameFolder(
			{ id: folder.id, name: "Esportes" },
			{ folders },
		);

		expect(result.unwrap().name).toBe("Esportes");
	});

	it("recusa colidir com OUTRA pasta", async () => {
		await createFolder({ name: "Esportes" }, { folders, ids });
		const outra = (
			await createFolder({ name: "Cidades" }, { folders, ids })
		).unwrap();

		const result = await renameFolder(
			{ id: outra.id, name: "Esportes" },
			{ folders },
		);

		expect(result.unwrapErr()).toBeInstanceOf(FolderNameTaken);
	});

	it("pasta inexistente", async () => {
		expect(
			(await renameFolder({ id: "nao-existe", name: "X" }, { folders }))
				.unwrapErr(),
		).toBeInstanceOf(FolderNotFound);
	});
});

describe("deleteFolder (D3 — pasta com arquivo não se exclui)", () => {
	it("exclui pasta vazia", async () => {
		const folder = (
			await createFolder({ name: "Vazia" }, { folders, ids })
		).unwrap();

		expect((await deleteFolder({ id: folder.id }, { folders })).isOk()).toBe(
			true,
		);
		expect(await listFolders({ folders })).toHaveLength(0);
	});

	it("recusa pasta com arquivo dentro", async () => {
		const folder = (
			await createFolder({ name: "Cheia" }, { folders, ids })
		).unwrap();
		folders.setAssetCount(folder.id, 12);

		const result = await deleteFolder({ id: folder.id }, { folders });

		expect(result.unwrapErr()).toBeInstanceOf(FolderNotEmpty);
		// A pasta CONTINUA lá — recusar e apagar mesmo assim seria pior que nada.
		expect(await listFolders({ folders })).toHaveLength(1);
	});

	// "Não está vazia" manda o usuário adivinhar; "tem 12 arquivos" é acionável.
	it("a mensagem diz QUANTOS arquivos, e concorda em número", async () => {
		const folder = (
			await createFolder({ name: "Cheia" }, { folders, ids })
		).unwrap();

		folders.setAssetCount(folder.id, 12);
		expect(
			(await deleteFolder({ id: folder.id }, { folders })).unwrapErr().message,
		).toContain("12 arquivos");

		folders.setAssetCount(folder.id, 1);
		expect(
			(await deleteFolder({ id: folder.id }, { folders })).unwrapErr().message,
		).toContain("1 arquivo dentro");
	});
});

describe("moveAsset", () => {
	it("move para uma pasta", async () => {
		const asset = await novaImagem();
		const folder = (
			await createFolder({ name: "Esportes" }, { folders, ids })
		).unwrap();

		expect(
			(await moveAsset({ id: asset.id, folderId: folder.id }, { repo, folders }))
				.isOk(),
		).toBe(true);
		expect((await repo.findById(asset.id))?.folderId).toBe(folder.id);
	});

	// "Sem pasta" é estado válido (D2): tirar da pasta não é apagar nem exige
	// uma pasta "Outros" de despejo.
	it("move para FORA de qualquer pasta", async () => {
		const asset = await novaImagem();
		const folder = (
			await createFolder({ name: "Esportes" }, { folders, ids })
		).unwrap();
		await moveAsset({ id: asset.id, folderId: folder.id }, { repo, folders });

		await moveAsset({ id: asset.id, folderId: null }, { repo, folders });

		expect((await repo.findById(asset.id))?.folderId).toBeNull();
	});

	it("recusa pasta inexistente, e não mexe no arquivo", async () => {
		const asset = await novaImagem();

		const result = await moveAsset(
			{ id: asset.id, folderId: "nao-existe" },
			{ repo, folders },
		);

		expect(result.unwrapErr()).toBeInstanceOf(FolderNotFound);
		expect((await repo.findById(asset.id))?.folderId).toBeNull();
	});

	it("arquivo inexistente", async () => {
		expect(
			(await moveAsset({ id: "nao-existe", folderId: null }, { repo, folders }))
				.unwrapErr(),
		).toBeInstanceOf(MediaAssetNotFound);
	});
});

describe("deleteAsset (D4/D5)", () => {
	it("exclui do banco E do storage", async () => {
		const asset = await novaImagem("uploads/1/foto.jpg");
		storage.put("uploads/1/foto.jpg", new Uint8Array([1, 2, 3]));

		expect((await deleteAsset({ id: asset.id }, { repo, storage, usage })).isOk()).toBe(
			true,
		);
		expect(await repo.findById(asset.id)).toBeNull();
		expect(storage.get("uploads/1/foto.jpg")).toBeNull();
	});

	// Sem esta guarda, apagar não dá erro em lugar nenhum: o portal passa a
	// servir imagem quebrada e ninguém descobre até um leitor reclamar.
	it("recusa mídia em uso por matéria, e NÃO apaga nada", async () => {
		const asset = await novaImagem();
		usage.markInUse(asset.id);

		const result = await deleteAsset({ id: asset.id }, { repo, storage, usage });

		expect(result.unwrapErr()).toBeInstanceOf(MediaInUse);
		expect(await repo.findById(asset.id)).not.toBeNull();
	});

	it("arquivo inexistente", async () => {
		expect(
			(await deleteAsset({ id: "nao-existe" }, { repo, storage, usage })).unwrapErr(),
		).toBeInstanceOf(MediaAssetNotFound);
	});

	/**
	 * O caminho em que banco e bucket discordam — e o único que ninguém executa
	 * à mão. A linha já se foi, e é ela que a biblioteca lê; um objeto órfão no
	 * bucket é invisível e custa centavos. Reverter deixaria a biblioteca
	 * mostrando um item que aponta para arquivo inexistente (D5).
	 */
	it("falha no storage NÃO ressuscita a linha nem estoura", async () => {
		const asset = await novaImagem();
		vi.spyOn(storage, "delete").mockRejectedValue(new Error("R2 fora do ar"));

		const result = await deleteAsset({ id: asset.id }, { repo, storage, usage });

		expect(result.isOk()).toBe(true);
		expect(await repo.findById(asset.id)).toBeNull();
	});
});

describe("ações em lote (D7 — relata item a item)", () => {
	it("exclui o que pode e relata o que não pôde", async () => {
		const a = await novaImagem("uploads/a/a.jpg");
		const b = await novaImagem("uploads/b/b.jpg");
		const c = await novaImagem("uploads/c/c.jpg");
		usage.markInUse(b.id);

		const outcome = await deleteAssets(
			{ ids: [a.id, b.id, c.id] },
			{ repo, storage, usage },
		);

		// Os que passaram FICAM feitos — abortar tudo obrigaria o editor a
		// descobrir por tentativa e erro qual arquivo trava a operação.
		expect(outcome.ok).toEqual([a.id, c.id]);
		expect(outcome.failed).toHaveLength(1);
		expect(outcome.failed[0]?.id).toBe(b.id);
		expect(outcome.failed[0]?.reason).toContain("em uso");
		expect(await repo.findById(a.id)).toBeNull();
		expect(await repo.findById(b.id)).not.toBeNull();
	});

	it("move em lote e relata o que falhou", async () => {
		const a = await novaImagem("uploads/a/a.jpg");
		const folder = (
			await createFolder({ name: "Destino" }, { folders, ids })
		).unwrap();

		const outcome = await moveAssets(
			{ ids: [a.id, "nao-existe"], folderId: folder.id },
			{ repo, folders },
		);

		expect(outcome.ok).toEqual([a.id]);
		expect(outcome.failed.map((f) => f.id)).toEqual(["nao-existe"]);
		expect((await repo.findById(a.id))?.folderId).toBe(folder.id);
	});

	it("lote vazio não é erro", async () => {
		const outcome = await deleteAssets({ ids: [] }, { repo, storage, usage });

		expect(outcome).toEqual({ ok: [], failed: [] });
	});
});
