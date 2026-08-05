import type { PrismaClient } from "@portal-app/db/client";

import type { TagRepository } from "../domain/ports/tag-repository";
import { Tag } from "../domain/tag";

/** Adapter Prisma da porta `TagRepository`. Mesmo desenho do de editorias. */
export class PrismaTagRepository implements TagRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Tag | null> {
		const row = await this.prisma.tag.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findBySlug(slug: string): Promise<Tag | null> {
		const row = await this.prisma.tag.findUnique({ where: { slug } });
		return row ? toDomain(row) : null;
	}

	async save(tag: Tag): Promise<void> {
		const data = { id: tag.id, name: tag.name, slug: tag.slug };
		await this.prisma.tag.upsert({
			where: { id: tag.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.tag.delete({ where: { id } });
	}

	async list(): Promise<Tag[]> {
		const rows = await this.prisma.tag.findMany({ orderBy: { name: "asc" } });
		return rows.map(toDomain);
	}
}

function toDomain(row: { id: string; name: string; slug: string }): Tag {
	return Tag.restore({ id: row.id, name: row.name, slug: row.slug });
}
