import { newPrismaClient } from "@portal-app/db/client";
import {
	InMemoryMediaRepository,
	MediaAsset,
	type MediaRepository,
} from "@portal-app/media";
import { PrismaMediaRepository } from "@portal-app/media/infrastructure/prisma-media-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

type Harness = { repo: MediaRepository; reset: () => Promise<void> };

function fakeHarness(): Harness {
	const repo = new InMemoryMediaRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaHarness(): Harness {
	return {
		repo: new PrismaMediaRepository(prisma),
		reset: async () => {
			await prisma.mediaAsset.deleteMany();
		},
	};
}

function imageAt(id: string, storageKey: string, filename: string): MediaAsset {
	return MediaAsset.create({
		id,
		type: "IMAGE",
		storageKey,
		filename,
		mimeType: "image/jpeg",
		credit: "Foto: Ana",
		altText: "Descrição",
		caption: "Legenda",
		dimensions: { width: 1600, height: 900 },
		focalPoint: { x: 0.4, y: 0.6 },
	}).unwrap();
}

function contract(label: string, make: () => Harness): void {
	describe(`MediaRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("M11: salva com todos os metadados e recupera por id e storageKey", async () => {
			await h.repo.save(imageAt("asset-1", "uploads/a/foto.jpg", "foto.jpg"));

			const byId = await h.repo.findById("asset-1");
			expect(byId?.credit.value).toBe("Foto: Ana");
			expect(byId?.altText?.value).toBe("Descrição");
			expect(byId?.dimensions?.width).toBe(1600);
			expect(byId?.focalPoint?.x).toBe(0.4);
			expect(byId?.caption.value).toBe("Legenda");

			const byKey = await h.repo.findByStorageKey("uploads/a/foto.jpg");
			expect(byKey?.id).toBe("asset-1");
		});

		it("lista, filtra por tipo e por busca", async () => {
			await h.repo.save(imageAt("a1", "k1", "estadio.jpg"));
			await h.repo.save(imageAt("a2", "k2", "entrevista.jpg"));

			expect(await h.repo.list()).toHaveLength(2);
			expect(await h.repo.list({ type: "IMAGE" })).toHaveLength(2);
			expect(await h.repo.list({ type: "DOCUMENT" })).toHaveLength(0);

			const found = await h.repo.list({ search: "estadio" });
			expect(found.map((a) => a.id)).toEqual(["a1"]);
		});

		it("exclui e some da busca", async () => {
			await h.repo.save(imageAt("a1", "k1", "foto.jpg"));
			await h.repo.delete("a1");

			expect(await h.repo.findById("a1")).toBeNull();
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
			expect(await h.repo.findByStorageKey("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fakeHarness);
contract("prisma", prismaHarness);
