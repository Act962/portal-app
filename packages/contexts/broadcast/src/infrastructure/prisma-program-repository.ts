import type { PrismaClient } from "@portal-app/db/client";

import type { ProgramRepository } from "../domain/ports/program-repository";
import { Program } from "../domain/program";

/**
 * Adapter Prisma da porta `ProgramRepository`. Única camada que conhece
 * Prisma. Recebe o `PrismaClient` por injeção (não o singleton), o que o
 * torna testável contra o Postgres do Testcontainers no mesmo contrato que o
 * fake.
 */
export class PrismaProgramRepository implements ProgramRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Program | null> {
		const row = await this.prisma.program.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async save(program: Program): Promise<void> {
		const data = toPersistence(program);
		await this.prisma.program.upsert({
			where: { id: program.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.program.delete({ where: { id } });
	}

	async list(): Promise<Program[]> {
		const rows = await this.prisma.program.findMany({
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { order: "asc" }],
		});
		return rows.map(toDomain);
	}
}

type ProgramRow = {
	id: string;
	name: string;
	host: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	order: number;
};

function toPersistence(program: Program) {
	return {
		id: program.id,
		name: program.name,
		host: program.host,
		dayOfWeek: program.dayOfWeek,
		startTime: program.startTime,
		endTime: program.endTime,
		order: program.order,
	};
}

function toDomain(row: ProgramRow): Program {
	return Program.restore({
		id: row.id,
		name: row.name,
		host: row.host,
		dayOfWeek: row.dayOfWeek,
		startTime: row.startTime,
		endTime: row.endTime,
		order: row.order,
	});
}
