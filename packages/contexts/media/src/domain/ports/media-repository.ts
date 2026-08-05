import type { MediaAsset } from "../media-asset";
import type { MediaType } from "../media-type";

/** Filtro da biblioteca: busca textual (nome/legenda/crédito) e tipo. */
export type MediaQuery = {
	search?: string;
	type?: MediaType;
};

/**
 * Porta de persistência do agregado `MediaAsset`. `save` é upsert por id;
 * `list` alimenta a biblioteca (busca + filtro por tipo), do mais recente ao
 * mais antigo.
 */
export interface MediaRepository {
	findById(id: string): Promise<MediaAsset | null>;
	findByStorageKey(storageKey: string): Promise<MediaAsset | null>;
	save(asset: MediaAsset): Promise<void>;
	delete(id: string): Promise<void>;
	list(query?: MediaQuery): Promise<MediaAsset[]>;
}

/** Fake in-memory da porta — roda no mesmo contrato que o adapter Prisma. */
export class InMemoryMediaRepository implements MediaRepository {
	private readonly store = new Map<string, MediaAsset>();
	/** Ordem de inserção, para devolver do mais recente ao mais antigo. */
	private seq = 0;
	private readonly order = new Map<string, number>();

	findById(id: string): Promise<MediaAsset | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findByStorageKey(storageKey: string): Promise<MediaAsset | null> {
		for (const asset of this.store.values()) {
			if (asset.storageKey === storageKey) {
				return Promise.resolve(asset);
			}
		}
		return Promise.resolve(null);
	}

	save(asset: MediaAsset): Promise<void> {
		if (!this.order.has(asset.id)) {
			this.seq += 1;
			this.order.set(asset.id, this.seq);
		}
		this.store.set(asset.id, asset);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		this.order.delete(id);
		return Promise.resolve();
	}

	list(query?: MediaQuery): Promise<MediaAsset[]> {
		const term = query?.search?.trim().toLowerCase();
		const result = [...this.store.values()]
			.filter((asset) => (query?.type ? asset.type === query.type : true))
			.filter((asset) => (term ? matches(asset, term) : true))
			.sort((a, b) => (this.order.get(b.id) ?? 0) - (this.order.get(a.id) ?? 0));
		return Promise.resolve(result);
	}

	clear(): void {
		this.store.clear();
		this.order.clear();
		this.seq = 0;
	}
}

function matches(asset: MediaAsset, term: string): boolean {
	return (
		asset.filename.toLowerCase().includes(term) ||
		asset.caption.value.toLowerCase().includes(term) ||
		asset.credit.value.toLowerCase().includes(term)
	);
}
