import { SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	InMemoryMediaRepository,
	InMemoryMediaStorage,
	MissingCredit,
	getAsset,
	listLibrary,
	registerAsset,
	requestUpload,
} from "@portal-app/media";
import { beforeEach, describe, expect, it } from "vitest";

let repo: InMemoryMediaRepository;
let storage: InMemoryMediaStorage;
let ids: SequentialIdGenerator;

beforeEach(() => {
	repo = new InMemoryMediaRepository();
	storage = new InMemoryMediaStorage();
	ids = new SequentialIdGenerator("media");
});

const image = {
	type: "IMAGE" as const,
	filename: "foto.jpg",
	mimeType: "image/jpeg",
	credit: "Foto: Ana",
	altText: "Torcida",
	dimensions: { width: 1600, height: 900 },
};

describe("requestUpload (A28)", () => {
	it("gera storageKey saneada e URL pré-assinada", async () => {
		const { key, url } = await requestUpload(
			{ filename: "Foto Final!.JPG", contentType: "image/jpeg" },
			{ storage, ids },
		);

		expect(key).toBe("uploads/media-1/foto-final-.jpg");
		expect(url).toBe(`memory://upload/${key}`);
	});
});

describe("registerAsset (invariantes A29)", () => {
	it("registra imagem válida e a torna consultável", async () => {
		const asset = (
			await registerAsset({ ...image, storageKey: "uploads/x/foto.jpg" }, { repo, ids })
		).unwrap();

		expect(asset.credit.value).toBe("Foto: Ana");
		expect(await getAsset(asset.id, { repo })).not.toBeNull();
		expect(await repo.findByStorageKey("uploads/x/foto.jpg")).not.toBeNull();
		expect(await repo.findByStorageKey("nao-existe")).toBeNull();
	});

	it("rejeita registro sem crédito (domínio, não tela)", async () => {
		const result = await registerAsset(
			{ ...image, credit: "  ", storageKey: "uploads/x/foto.jpg" },
			{ repo, ids },
		);

		expect(result.unwrapErr()).toBeInstanceOf(MissingCredit);
		expect(await listLibrary({}, { repo })).toHaveLength(0);
	});
});

describe("listLibrary (busca + filtro)", () => {
	beforeEach(async () => {
		await registerAsset(
			{ ...image, filename: "estadio.jpg", credit: "Ana", storageKey: "k1" },
			{ repo, ids },
		);
		await registerAsset(
			{
				...image,
				filename: "entrevista.jpg",
				caption: "Coletiva do técnico",
				credit: "Bruno",
				storageKey: "k2",
			},
			{ repo, ids },
		);
		await registerAsset(
			{
				type: "DOCUMENT",
				filename: "edital.pdf",
				mimeType: "application/pdf",
				credit: "Prefeitura",
				storageKey: "k3",
			},
			{ repo, ids },
		);
	});

	it("lista do mais recente ao mais antigo", async () => {
		const all = await listLibrary({}, { repo });
		expect(all.map((a) => a.filename)).toEqual(["edital.pdf", "entrevista.jpg", "estadio.jpg"]);
	});

	it("filtra por tipo", async () => {
		const docs = await listLibrary({ type: "DOCUMENT" }, { repo });
		expect(docs).toHaveLength(1);
		expect(docs[0]?.filename).toBe("edital.pdf");
	});

	it("busca por nome de arquivo", async () => {
		const found = await listLibrary({ search: "estadio" }, { repo });
		expect(found.map((a) => a.filename)).toEqual(["estadio.jpg"]);
	});

	it("busca por legenda", async () => {
		const found = await listLibrary({ search: "coletiva" }, { repo });
		expect(found.map((a) => a.filename)).toEqual(["entrevista.jpg"]);
	});

	it("busca por crédito", async () => {
		const found = await listLibrary({ search: "prefeitura" }, { repo });
		expect(found.map((a) => a.filename)).toEqual(["edital.pdf"]);
	});
});
