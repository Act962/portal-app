import { newPrismaClient } from "@portal-app/db/client";
import {
	Folder,
	type FolderRepository,
	InMemoryFolderRepository,
	MediaAsset,
} from "@portal-app/media";
import { PrismaFolderRepository } from "@portal-app/media/infrastructure/prisma-folder-repository";
import { PrismaMediaRepository } from "@portal-app/media/infrastructure/prisma-media-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

type Harness = {
	repo: FolderRepository;
	/** Põe N arquivos dentro da pasta — é o que `countAssets` tem de enxergar. */
	fillWithAssets: (folderId: string, count: number) => Promise<void>;
	reset: () => Promise<void>;
};

function fakeHarness(): Harness {
	const repo = new InMemoryFolderRepository();
	return {
		repo,
		fillWithAssets: (folderId, count) => {
			repo.setAssetCount(folderId, count);
			return Promise.resolve();
		},
		reset: () => Promise.resolve(repo.clear()),
	};
}

function prismaHarness(): Harness {
	const media = new PrismaMediaRepository(prisma);
	return {
		repo: new PrismaFolderRepository(prisma),
		fillWithAssets: async (folderId, count) => {
			for (let i = 0; i < count; i++) {
				const asset = MediaAsset.create({
					id: `a-${folderId}-${i}`,
					type: "IMAGE",
					storageKey: `uploads/${folderId}/${i}.jpg`,
					filename: `${i}.jpg`,
					mimeType: "image/jpeg",
					credit: "Foto: Ana",
					altText: "Descrição",
					dimensions: { width: 800, height: 600 },
					folderId,
				}).unwrap();
				await media.save(asset);
			}
		},
		reset: async () => {
			// Assets primeiro: a FK é `Restrict`, e é justamente essa a garantia.
			await prisma.mediaAsset.deleteMany();
			await prisma.mediaFolder.deleteMany();
		},
	};
}

function contract(label: string, make: () => Harness): void {
	describe(`FolderRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("salva e recupera por id", async () => {
			await h.repo.save(Folder.create({ id: "f-1", name: "Esportes" }).unwrap());

			expect((await h.repo.findById("f-1"))?.name).toBe("Esportes");
		});

		it("save é upsert — renomear não duplica", async () => {
			const folder = Folder.create({ id: "f-1", name: "Antigo" }).unwrap();
			await h.repo.save(folder);
			folder.rename("Novo");
			await h.repo.save(folder);

			expect(await h.repo.list()).toHaveLength(1);
			expect((await h.repo.findById("f-1"))?.name).toBe("Novo");
		});

		// A busca por nome é o que sustenta a recusa de nome repetido. Se as duas
		// implementações discordassem na CAIXA, o fake aceitaria "esportes" e o
		// Postgres recusaria — erro de constraint cru na cara do usuário.
		it("findByName ignora caixa e espaços das pontas", async () => {
			await h.repo.save(Folder.create({ id: "f-1", name: "Esportes" }).unwrap());

			expect((await h.repo.findByName("esportes"))?.id).toBe("f-1");
			expect((await h.repo.findByName("  ESPORTES  "))?.id).toBe("f-1");
			expect(await h.repo.findByName("Cidades")).toBeNull();
		});

		it("lista em ordem alfabética", async () => {
			await h.repo.save(Folder.create({ id: "f-1", name: "Zoologia" }).unwrap());
			await h.repo.save(Folder.create({ id: "f-2", name: "Cidades" }).unwrap());
			await h.repo.save(Folder.create({ id: "f-3", name: "Esportes" }).unwrap());

			expect((await h.repo.list()).map((f) => f.name)).toEqual([
				"Cidades",
				"Esportes",
				"Zoologia",
			]);
		});

		// É o número que aparece na mensagem de recusa ("tem 12 arquivos"), então
		// as duas implementações precisam contar igual.
		it("countAssets conta o que está na pasta", async () => {
			await h.repo.save(Folder.create({ id: "f-1", name: "Cheia" }).unwrap());
			await h.repo.save(Folder.create({ id: "f-2", name: "Vazia" }).unwrap());
			await h.fillWithAssets("f-1", 3);

			expect(await h.repo.countAssets("f-1")).toBe(3);
			expect(await h.repo.countAssets("f-2")).toBe(0);
		});

		it("exclui pasta vazia", async () => {
			await h.repo.save(Folder.create({ id: "f-1", name: "Vazia" }).unwrap());

			await h.repo.delete("f-1");

			expect(await h.repo.findById("f-1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
			expect(await h.repo.findByName("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fakeHarness);
contract("prisma", prismaHarness);

/**
 * A rede de segurança do invariante D3, e só o Postgres a tem: mesmo que a
 * regra da aplicação falhe, ou alguém apague direto no banco, a FK `Restrict`
 * recusa. É por isso que o teste é exclusivo do adapter real — o fake não pode
 * provar nada sobre uma garantia que mora no schema.
 */
describe("PrismaFolderRepository — a FK protege a pasta cheia", () => {
	beforeEach(async () => {
		await prisma.mediaAsset.deleteMany();
		await prisma.mediaFolder.deleteMany();
	});

	it("o banco RECUSA excluir pasta com arquivo dentro", async () => {
		const folders = new PrismaFolderRepository(prisma);
		const media = new PrismaMediaRepository(prisma);
		await folders.save(Folder.create({ id: "f-1", name: "Cheia" }).unwrap());
		await media.save(
			MediaAsset.create({
				id: "a-1",
				type: "IMAGE",
				storageKey: "uploads/a-1/foto.jpg",
				filename: "foto.jpg",
				mimeType: "image/jpeg",
				credit: "Foto: Ana",
				altText: "Descrição",
				dimensions: { width: 800, height: 600 },
				folderId: "f-1",
			}).unwrap(),
		);

		await expect(folders.delete("f-1")).rejects.toThrow();
		expect(await folders.findById("f-1")).not.toBeNull();
	});
});
