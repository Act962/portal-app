import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { MediaStorage } from "../domain/ports/media-storage";

export type S3StorageConfig = {
	/** Endpoint S3: R2 (`https://<acct>.r2.cloudflarestorage.com`) ou MinIO. */
	endpoint: string;
	/** `auto` no R2; `us-east-1` no MinIO. */
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	/** Base pública de leitura (domínio do bucket público ou `endpoint/bucket`). */
	publicUrl: string;
	/** MinIO exige path-style (`endpoint/bucket/key`); R2 usa virtual-hosted. */
	forcePathStyle: boolean;
	/** Validade da URL pré-assinada, em segundos. */
	uploadExpirySeconds?: number;
};

/**
 * Adapter S3 da porta `MediaStorage`, usado tanto pelo R2 (produção) quanto pelo
 * MinIO (dev/CI) — os dois falam a API S3. Recebe a config por injeção (não lê
 * env), o que o torna testável no contrato contra o MinIO do Testcontainers.
 */
export class S3MediaStorage implements MediaStorage {
	private readonly client: S3Client;
	private readonly expiry: number;

	constructor(private readonly config: S3StorageConfig) {
		this.expiry = config.uploadExpirySeconds ?? 900;
		this.client = new S3Client({
			endpoint: config.endpoint,
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			forcePathStyle: config.forcePathStyle,
		});
	}

	getUploadUrl(key: string, contentType: string): Promise<string> {
		const command = new PutObjectCommand({
			Bucket: this.config.bucket,
			Key: key,
			ContentType: contentType,
		});
		return getSignedUrl(this.client, command, { expiresIn: this.expiry });
	}

	publicUrl(key: string): string {
		return `${this.config.publicUrl.replace(/\/+$/, "")}/${key}`;
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
		);
	}
}
