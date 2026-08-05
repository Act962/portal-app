import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { S3MediaStorage } from "@portal-app/media/infrastructure/s3-media-storage";
import { PrismaMediaRepository } from "@portal-app/media/infrastructure/prisma-media-repository";
import { UuidGenerator } from "@portal-app/shared-kernel";

/**
 * Raiz de composição da mídia no lado servidor. Instancia a infraestrutura do
 * contexto (repositório Prisma + storage S3) a partir do env tipado, para o app
 * consumir só isto — `infra-nao-vaza` satisfeito.
 *
 * O mesmo `S3MediaStorage` serve o MinIO (dev/CI, via defaults do env) e o R2
 * (produção, quando o env apontar para lá). O `storage` é exportado à parte
 * porque o router precisa dele para montar a URL pública dos assets.
 */
const prisma = createPrismaClient();

export const mediaStorage = new S3MediaStorage({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	accessKeyId: env.S3_ACCESS_KEY_ID,
	secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	bucket: env.S3_BUCKET,
	publicUrl: env.S3_PUBLIC_URL,
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

export const mediaDeps = {
	repo: new PrismaMediaRepository(prisma),
	storage: mediaStorage,
	ids: new UuidGenerator(),
};
