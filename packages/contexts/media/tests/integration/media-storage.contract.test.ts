import {
	CreateBucketCommand,
	GetObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { InMemoryMediaStorage, type MediaStorage } from "@portal-app/media";
import {
	S3MediaStorage,
	type S3StorageConfig,
} from "@portal-app/media/infrastructure/s3-media-storage";
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Contrato de `MediaStorage`, rodado contra o fake in-memory E contra um
 * servidor S3 real (Testcontainers). É o que legitima usar o fake nos testes de
 * aplicação: se ambos honram getUploadUrl → upload → leitura → delete, o fake é
 * fiel ao S3.
 *
 * O transporte difere (o servidor usa HTTP de verdade; o fake simula em
 * memória), então cada harness abstrai o "upload" e o "download"; o contrato é
 * o mesmo.
 *
 * O servidor é o RustFS, e não mais o MinIO: as imagens do MinIO saíram do
 * Docker Hub e depois do quay.io, e o CI passou a falhar no `pull` com
 * "unauthorized" antes de rodar qualquer teste. O RustFS fala a mesma API e
 * sobe do mesmo jeito (um binário, chave e segredo por variável de ambiente).
 */

type StorageHarness = {
	storage: MediaStorage;
	upload: (url: string, body: Uint8Array, contentType: string) => Promise<void>;
	download: (key: string) => Promise<Uint8Array | null>;
};

const ACCESS_KEY = "testaccesskey";
const SECRET_KEY = "testsecretkey";
const S3_PORT = 9000;

let server: StartedTestContainer | undefined;
let s3Config: S3StorageConfig | undefined;
let s3Client: S3Client | undefined;

beforeAll(async () => {
	// Versão fixa: `latest` muda sem aviso. Do quay.io, e não do Docker Hub,
	// para não gastar o limite de `pull` anônimo que os runners do CI dividem.
	server = await new GenericContainer("quay.io/rustfs/rustfs:1.0.1")
		.withEnvironment({
			RUSTFS_ACCESS_KEY: ACCESS_KEY,
			RUSTFS_SECRET_KEY: SECRET_KEY,
		})
		.withCommand(["/data"])
		.withExposedPorts(S3_PORT)
		.withWaitStrategy(Wait.forHttp("/health", S3_PORT))
		.start();

	const endpoint = `http://${server.getHost()}:${server.getMappedPort(S3_PORT)}`;
	s3Config = {
		endpoint,
		region: "us-east-1",
		accessKeyId: ACCESS_KEY,
		secretAccessKey: SECRET_KEY,
		bucket: "test-bucket",
		publicUrl: `${endpoint}/test-bucket`,
		forcePathStyle: true,
	};
	s3Client = new S3Client({
		endpoint,
		region: s3Config.region,
		credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
		forcePathStyle: true,
	});

	await s3Client.send(new CreateBucketCommand({ Bucket: s3Config.bucket }));
}, 180_000);

afterAll(async () => {
	await server?.stop();
});

function fakeHarness(): StorageHarness {
	const fake = new InMemoryMediaStorage();
	return {
		storage: fake,
		upload: (url, body) => {
			const key = url.replace("memory://upload/", "");
			fake.put(key, body);
			return Promise.resolve();
		},
		download: (key) => Promise.resolve(fake.get(key)),
	};
}

function s3Harness(): StorageHarness {
	const config = s3Config as S3StorageConfig;
	const client = s3Client as S3Client;
	return {
		storage: new S3MediaStorage(config),
		upload: async (url, body, contentType) => {
			const res = await fetch(url, {
				method: "PUT",
				body,
				headers: { "content-type": contentType },
			});
			if (!res.ok) {
				throw new Error(`PUT falhou: ${res.status} ${await res.text()}`);
			}
		},
		download: async (key) => {
			try {
				const out = await client.send(
					new GetObjectCommand({ Bucket: config.bucket, Key: key }),
				);
				return out.Body ? await out.Body.transformToByteArray() : null;
			} catch {
				// NoSuchKey depois do delete → ausência.
				return null;
			}
		},
	};
}

function contract(label: string, makeHarness: () => StorageHarness): void {
	describe(`MediaStorage — contrato (${label})`, () => {
		it("M09/M10: gera URL pré-assinada, sobe, lê e depois remove o objeto", async () => {
			const h = makeHarness();
			const key = `contract/${label}/imagem.bin`;
			const body = new Uint8Array([10, 20, 30, 40, 50]);

			const url = await h.storage.getUploadUrl(key, "application/octet-stream");
			expect(typeof url).toBe("string");
			expect(url.length).toBeGreaterThan(0);

			await h.upload(url, body, "application/octet-stream");

			const got = await h.download(key);
			expect(got).not.toBeNull();
			expect(Array.from(got as Uint8Array)).toEqual(Array.from(body));

			await h.storage.delete(key);
			expect(await h.download(key)).toBeNull();
		});

		it("publicUrl aponta para a key", () => {
			const h = makeHarness();
			expect(h.storage.publicUrl("2026/08/foto.jpg")).toContain(
				"2026/08/foto.jpg",
			);
		});
	});
}

contract("in-memory", fakeHarness);
contract("s3", s3Harness);
