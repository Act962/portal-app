import type { PrismaClient } from "@portal-app/db/client";

import type { SocialDestination } from "../domain/platform";
import type {
	ArtTemplateFilter,
	ArtTemplateRepository,
} from "../domain/ports/art-template-repository";
import {
	type ArtFormat,
	ArtTemplate,
	type TemplateLayer,
} from "../domain/template/art-template";

/** Adapter Prisma dos padrões de arte. Única camada que conhece Prisma. */
export class PrismaArtTemplateRepository implements ArtTemplateRepository {
	constructor(private readonly prisma: PrismaClient) {}

	save(template: ArtTemplate): Promise<void> {
		return this.saveAll([template]);
	}

	async saveAll(templates: readonly ArtTemplate[]): Promise<void> {
		await this.prisma.$transaction(
			templates.map((template) => {
				const data = toPersistence(template);
				return this.prisma.socialArtTemplate.upsert({
					where: { id: template.id },
					create: data,
					update: data,
				});
			}),
		);
	}

	async findById(id: string): Promise<ArtTemplate | null> {
		const row = await this.prisma.socialArtTemplate.findUnique({
			where: { id },
		});
		return row ? toDomain(row) : null;
	}

	async list(filter: ArtTemplateFilter): Promise<readonly ArtTemplate[]> {
		const rows = await this.prisma.socialArtTemplate.findMany({
			where: {
				...(filter.includeArchived ? {} : { archived: false }),
				...(filter.format ? { format: filter.format } : {}),
			},
			orderBy: [{ name: "asc" }, { createdAt: "asc" }],
		});
		return rows.map(toDomain);
	}

	async findDefaultFor(
		destination: SocialDestination,
	): Promise<ArtTemplate | null> {
		const row = await this.prisma.socialArtTemplate.findFirst({
			where: { archived: false, defaultFor: { has: destination } },
			// Dois marcados não deveria existir (D10); se existir, vale o mais
			// recente — foi a última decisão de alguém.
			orderBy: { updatedAt: "desc" },
		});
		return row ? toDomain(row) : null;
	}

	async usesMedia(mediaId: string): Promise<boolean> {
		const count = await this.prisma.socialArtTemplate.count({
			where: { mediaIds: { has: mediaId } },
		});
		return count > 0;
	}
}

type TemplateRow = {
	id: string;
	name: string;
	format: string;
	layers: unknown;
	defaultFor: string[];
	version: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
};

function toPersistence(template: ArtTemplate) {
	return {
		id: template.id,
		name: template.name,
		format: template.format,
		// Serialização plana: o que entra no Json é exatamente o que o agregado
		// devolve, sem protótipo nem `undefined`.
		layers: JSON.parse(JSON.stringify(template.layers)),
		defaultFor: [...template.defaultFor],
		mediaIds: [...template.mediaIds],
		version: template.version,
		archived: template.archived,
		createdAt: template.createdAt,
		updatedAt: template.updatedAt,
	};
}

function toDomain(row: TemplateRow): ArtTemplate {
	return ArtTemplate.restore({
		id: row.id,
		name: row.name,
		format: row.format as ArtFormat,
		// Só este repositório escreve a coluna, sempre a partir de um agregado
		// válido — por isso a leitura confia, como `restore` confia.
		layers: (Array.isArray(row.layers) ? row.layers : []) as TemplateLayer[],
		defaultFor: row.defaultFor as SocialDestination[],
		version: row.version,
		archived: row.archived,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}
