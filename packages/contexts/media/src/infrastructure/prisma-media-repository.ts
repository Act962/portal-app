import type { PrismaClient } from "@portal-app/db/client";

import { MediaAsset } from "../domain/media-asset";
import type { MediaType } from "../domain/media-type";
import type { MediaQuery, MediaRepository } from "../domain/ports/media-repository";

/**
 * Adapter Prisma da porta `MediaRepository`. Única camada que conhece Prisma;
 * recebe o client por injeção, testável no contrato contra o Postgres do
 * Testcontainers.
 */
export class PrismaMediaRepository implements MediaRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<MediaAsset | null> {
		const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findByStorageKey(storageKey: string): Promise<MediaAsset | null> {
		const row = await this.prisma.mediaAsset.findUnique({ where: { storageKey } });
		return row ? toDomain(row) : null;
	}

	async save(asset: MediaAsset): Promise<void> {
		const data = toPersistence(asset);
		await this.prisma.mediaAsset.upsert({
			where: { id: asset.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.mediaAsset.delete({ where: { id } });
	}

	async list(query?: MediaQuery): Promise<MediaAsset[]> {
		const term = query?.search?.trim();
		const rows = await this.prisma.mediaAsset.findMany({
			where: {
				type: query?.type,
				...(term
					? {
							OR: [
								{ filename: { contains: term, mode: "insensitive" } },
								{ caption: { contains: term, mode: "insensitive" } },
								{ credit: { contains: term, mode: "insensitive" } },
							],
						}
					: {}),
			},
			orderBy: { createdAt: "desc" },
		});
		return rows.map(toDomain);
	}
}

type MediaRow = {
	id: string;
	type: string;
	storageKey: string;
	filename: string;
	mimeType: string;
	caption: string;
	credit: string;
	altText: string | null;
	width: number | null;
	height: number | null;
	focalX: number | null;
	focalY: number | null;
};

function toPersistence(asset: MediaAsset) {
	const dim = asset.dimensions;
	const focal = asset.focalPoint;
	return {
		id: asset.id,
		type: asset.type,
		storageKey: asset.storageKey,
		filename: asset.filename,
		mimeType: asset.mimeType,
		caption: asset.caption.value,
		credit: asset.credit.value,
		altText: asset.altText?.value ?? null,
		width: dim?.width ?? null,
		height: dim?.height ?? null,
		focalX: focal?.x ?? null,
		focalY: focal?.y ?? null,
	};
}

function toDomain(row: MediaRow): MediaAsset {
	return MediaAsset.restore({
		id: row.id,
		type: row.type as MediaType,
		storageKey: row.storageKey,
		filename: row.filename,
		mimeType: row.mimeType,
		caption: row.caption,
		credit: row.credit,
		altText: row.altText,
		dimensions: row.width !== null && row.height !== null ? { width: row.width, height: row.height } : null,
		focalPoint: row.focalX !== null && row.focalY !== null ? { x: row.focalX, y: row.focalY } : null,
	});
}
