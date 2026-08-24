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
 * Contrato de `MediaStorage`, rodado contra o fake in-memory E contra um MinIO
 * real (Testcontainers). É o que legitima usar o fake nos testes de aplicação:
 * se ambos honram getUploadUrl → upload → leitura → delete, o fake é fiel ao S3.
 *
 * O transporte difere (o MinIO usa HTTP de verdade; o fake simula em memória),
 * então cada harness abstrai o "upload" e o "download"; o contrato é o mesmo.
 */

type StorageHarness = {
	storage: MediaStorage;
	upload: (url: string, body: Uint8Array, contentType: string) => Promise<void>;
	download: (key: string) => Promise<Uint8Array | null>;
};

let minio: StartedTestContainer | undefined;
let minioConfig: S3StorageConfig | undefined;
let minioClient: S3Client | undefined;

beforeAll(async () => {
	minio = await new GenericContainer("minio/minio")
		.withEnvironment({
			MINIO_ROOT_USER: "minioadmin",
			MINIO_ROOT_PASSWORD: "minioadmin",
		})
		.withCommand(["server", "/data"])
		.withExposedPorts(9000)
		.withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
		.start();

	const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
	minioConfig = {
		endpoint,
		region: "us-east-1",
		accessKeyId: "minioadmin",
		secretAccessKey: "minioadmin",
		bucket: "test-bucket",
		publicUrl: `${endpoint}/test-bucket`,
		forcePathStyle: true,
	};
	minioClient = new S3Client({
		endpoint,
		region: minioConfig.region,
		credentials: { accessKeyId: "minioadmin", secretAccessKey: "minioadmin" },
		forcePathStyle: true,
	});
	await minioClient.send(
		new CreateBucketCommand({ Bucket: minioConfig.bucket }),
	);
}, 180_000);

afterAll(async () => {
	await minio?.stop();
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

function minioHarness(): StorageHarness {
	const config = minioConfig as S3StorageConfig;
	const client = minioClient as S3Client;
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
contract("minio", minioHarness);
