import type { PrismaClient } from "@portal-app/db/client";

import { Folder } from "../domain/folder";
import type { FolderRepository } from "../domain/ports/folder-repository";

/** Adapter Prisma da porta `FolderRepository`. */
export class PrismaFolderRepository implements FolderRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Folder | null> {
		const row = await this.prisma.mediaFolder.findUnique({ where: { id } });
		return row ? Folder.restore({ id: row.id, name: row.name }) : null;
	}

	async findByName(name: string): Promise<Folder | null> {
		// `insensitive` para "eleições" e "Eleições" contarem como a mesma pasta —
		// senão o cliente cria duas e só descobre quando procura numa e acha na
		// outra. O fake compara em minúsculas pelo mesmo motivo.
		const row = await this.prisma.mediaFolder.findFirst({
			where: { name: { equals: name.trim(), mode: "insensitive" } },
		});
		return row ? Folder.restore({ id: row.id, name: row.name }) : null;
	}

	async list(): Promise<Folder[]> {
		const rows = await this.prisma.mediaFolder.findMany({
			orderBy: { name: "asc" },
		});
		return rows.map((row) => Folder.restore({ id: row.id, name: row.name }));
	}

	async save(folder: Folder): Promise<void> {
		const data = { id: folder.id, name: folder.name };
		await this.prisma.mediaFolder.upsert({
			where: { id: folder.id },
			create: data,
			update: { name: folder.name },
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.mediaFolder.delete({ where: { id } });
	}

	countAssets(folderId: string): Promise<number> {
		return this.prisma.mediaAsset.count({ where: { folderId } });
	}
}
