import type { Folder } from "../folder";

/**
 * Porta de persistência de `Folder`. `save` é upsert por id.
 *
 * `countAssets` mora aqui, e não numa consulta solta, porque é o que sustenta o
 * invariante D3 — pasta com arquivo dentro não é excluída. Deixá-lo de fora
 * obrigaria a aplicação a pedir a lista inteira só para contar.
 */
export interface FolderRepository {
	findById(id: string): Promise<Folder | null>;
	/** Para recusar nome repetido antes de gravar. Comparação sem caixa. */
	findByName(name: string): Promise<Folder | null>;
	list(): Promise<Folder[]>;
	save(folder: Folder): Promise<void>;
	delete(id: string): Promise<void>;
	/** Quantos arquivos estão nesta pasta. */
	countAssets(folderId: string): Promise<number>;
}

/** Fake in-memory da porta — roda no mesmo contrato que o adapter Prisma. */
export class InMemoryFolderRepository implements FolderRepository {
	private readonly store = new Map<string, Folder>();
	/** Contagem por pasta, alimentada pelo repositório de mídia nos testes. */
	private readonly assetCounts = new Map<string, number>();

	findById(id: string): Promise<Folder | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findByName(name: string): Promise<Folder | null> {
		const wanted = name.trim().toLowerCase();
		for (const folder of this.store.values()) {
			if (folder.name.toLowerCase() === wanted) {
				return Promise.resolve(folder);
			}
		}
		return Promise.resolve(null);
	}

	list(): Promise<Folder[]> {
		return Promise.resolve(
			[...this.store.values()].sort((a, b) =>
				a.name.localeCompare(b.name, "pt-BR"),
			),
		);
	}

	save(folder: Folder): Promise<void> {
		this.store.set(folder.id, folder);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		this.assetCounts.delete(id);
		return Promise.resolve();
	}

	countAssets(folderId: string): Promise<number> {
		return Promise.resolve(this.assetCounts.get(folderId) ?? 0);
	}

	/** Só para teste: finge que a pasta tem N arquivos. */
	setAssetCount(folderId: string, count: number): void {
		this.assetCounts.set(folderId, count);
	}

	clear(): void {
		this.store.clear();
		this.assetCounts.clear();
	}
}
