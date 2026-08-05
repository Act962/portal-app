import type { PrismaClient } from "@portal-app/db/client";

import type { SectionRepository } from "../domain/ports/section-repository";
import { Section, type SectionStatus } from "../domain/section";

/**
 * Adapter Prisma da porta `SectionRepository`. Única camada que conhece Prisma.
 * Recebe o `PrismaClient` por injeção (não o singleton), o que o torna testável
 * contra o Postgres do Testcontainers no mesmo contrato que o fake.
 */
export class PrismaSectionRepository implements SectionRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Section | null> {
		const row = await this.prisma.section.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findBySlug(slug: string): Promise<Section | null> {
		const row = await this.prisma.section.findUnique({ where: { slug } });
		return row ? toDomain(row) : null;
	}

	async save(section: Section): Promise<void> {
		const data = toPersistence(section);
		await this.prisma.section.upsert({
			where: { id: section.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.section.delete({ where: { id } });
	}

	async list(): Promise<Section[]> {
		const rows = await this.prisma.section.findMany({
			orderBy: [{ order: "asc" }, { name: "asc" }],
		});
		return rows.map(toDomain);
	}
}

type SectionRow = {
	id: string;
	name: string;
	slug: string;
	description: string;
	color: string | null;
	order: number;
	status: string;
	parentId: string | null;
};

function toPersistence(section: Section) {
	return {
		id: section.id,
		name: section.name,
		slug: section.slug,
		description: section.description,
		color: section.color,
		order: section.order,
		status: section.status,
		parentId: section.parentId,
	};
}

function toDomain(row: SectionRow): Section {
	return Section.restore({
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		color: row.color,
		order: row.order,
		status: row.status as SectionStatus,
		parentId: row.parentId,
	});
}
