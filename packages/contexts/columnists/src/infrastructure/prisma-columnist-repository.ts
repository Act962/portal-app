import type { PrismaClient } from "@portal-app/db/client";

import { Columnist } from "../domain/columnist";
import type { ColumnistRepository } from "../domain/ports/columnist-repository";

/**
 * Adapter Prisma da porta `ColumnistRepository`. Única camada que conhece
 * Prisma. Recebe o `PrismaClient` por injeção (não o singleton), o que o torna
 * testável contra o Postgres do Testcontainers no mesmo contrato que o fake.
 */
export class PrismaColumnistRepository implements ColumnistRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Columnist | null> {
		const row = await this.prisma.columnist.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findBySlug(slug: string): Promise<Columnist | null> {
		const row = await this.prisma.columnist.findUnique({ where: { slug } });
		return row ? toDomain(row) : null;
	}

	async save(columnist: Columnist): Promise<void> {
		const data = toPersistence(columnist);
		await this.prisma.columnist.upsert({
			where: { id: columnist.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.columnist.delete({ where: { id } });
	}

	async list(): Promise<Columnist[]> {
		const rows = await this.prisma.columnist.findMany({
			orderBy: [{ order: "asc" }, { name: "asc" }],
		});
		return rows.map(toDomain);
	}
}

type ColumnistRow = {
	id: string;
	slug: string;
	name: string;
	beat: string;
	blurb: string;
	photoMediaId: string | null;
	socials: unknown;
	email: string | null;
	order: number;
	active: boolean;
};

function toPersistence(columnist: Columnist) {
	return {
		id: columnist.id,
		slug: columnist.slug,
		name: columnist.name,
		beat: columnist.beat,
		blurb: columnist.blurb,
		photoMediaId: columnist.photoMediaId,
		socials: columnist.socials,
		email: columnist.email,
		order: columnist.order,
		active: columnist.isActive,
	};
}

function toDomain(row: ColumnistRow): Columnist {
	return Columnist.restore({
		id: row.id,
		slug: row.slug,
		name: row.name,
		beat: row.beat,
		blurb: row.blurb,
		photoMediaId: row.photoMediaId,
		// `Json` chega como `unknown`; o `restore` normaliza e descarta o que não
		// for uma das quatro chaves conhecidas, então um Json arbitrário no banco
		// vira um objeto vazio em vez de vazar para a tela.
		socials: (row.socials ?? {}) as Record<string, string>,
		email: row.email,
		order: row.order,
		active: row.active,
	});
}
