import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import type { MediaUsage } from "@portal-app/media";
import { PrismaFolderRepository } from "@portal-app/media/infrastructure/prisma-folder-repository";
import { PrismaMediaRepository } from "@portal-app/media/infrastructure/prisma-media-repository";
import { S3MediaStorage } from "@portal-app/media/infrastructure/s3-media-storage";
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

/**
 * Adapter real da porta `MediaUsage` (spec 06, D4). Mora AQUI, na raiz de
 * composição, porque a resposta é do editorial e o contexto de mídia não pode
 * importar `Article` sem quebrar `contextos-isolados` — mesmo arranjo do
 * `ContentUsage` da taxonomia.
 *
 * Duas perguntas, porque a mídia entra na matéria por dois caminhos:
 * - **capa**: coluna `coverMediaId`, indexável;
 * - **corpo**: blocos `{ type: "image", mediaId }` dentro do Json `body`.
 *
 * O corpo é consultado com `array_contains` sobre o Json. Não é rápido como um
 * índice, mas roda uma vez por exclusão — não em rota de leitura — e a
 * alternativa (tabela de ligação mantida a cada salvamento) custaria migração e
 * um invariante novo para proteger algo que acontece raramente.
 *
 * Vale para QUALQUER estado, inclusive rascunho: bloquear só o publicado
 * deixaria o redator apagar a foto do rascunho do colega.
 */
class EditorialMediaUsage implements MediaUsage {
	async isMediaInUse(mediaId: string): Promise<boolean> {
		const [asCover, inBody] = await Promise.all([
			prisma.article.count({ where: { coverMediaId: mediaId } }),
			prisma.article.count({
				where: { body: { array_contains: [{ type: "image", mediaId }] } },
			}),
		]);
		return asCover + inBody > 0;
	}
}

export const mediaDeps = {
	repo: new PrismaMediaRepository(prisma),
	folders: new PrismaFolderRepository(prisma),
	storage: mediaStorage,
	usage: new EditorialMediaUsage(),
	ids: new UuidGenerator(),
};
