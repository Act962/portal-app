import type { PageRequest } from "@portal-app/shared-kernel";

import type { MediaAsset } from "../media-asset";
import type { MediaType } from "../media-type";

/** Filtro da biblioteca: busca textual (nome/legenda/crédito) e tipo. */
export type MediaQuery = {
	search?: string;
	type?: MediaType;
	/**
	 * Busca DIRIGIDA por ids. Existe para quem precisa resolver um conjunto
	 * conhecido — o editor de matéria, que traduz os `mediaId` do corpo em URL.
	 * Sem isto, aquela tela dependeria de a biblioteca inteira caber numa
	 * página, e a imagem de uma matéria antiga simplesmente não carregaria.
	 */
	ids?: readonly string[];
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
	/** Sem `page`, devolve tudo. Com `page`, o corte acontece no BANCO. */
	list(query?: MediaQuery, page?: PageRequest): Promise<MediaAsset[]>;
	/** Quantos itens satisfazem o filtro, ignorando a fatia. */
	count(query?: MediaQuery): Promise<number>;
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

	list(query?: MediaQuery, page?: PageRequest): Promise<MediaAsset[]> {
		const result = this.matching(query);
		if (!page) {
			return Promise.resolve(result);
		}
		return Promise.resolve(result.slice(page.offset, page.offset + page.limit));
	}

	count(query?: MediaQuery): Promise<number> {
		return Promise.resolve(this.matching(query).length);
	}

	/** Filtro e ordem sem a fatia — para `list` e `count` não divergirem. */
	private matching(query?: MediaQuery): MediaAsset[] {
		const term = query?.search?.trim().toLowerCase();
		return [...this.store.values()]
			.filter((asset) => (query?.ids ? query.ids.includes(asset.id) : true))
			.filter((asset) => (query?.type ? asset.type === query.type : true))
			.filter((asset) => (term ? matches(asset, term) : true))
			.sort((a, b) => (this.order.get(b.id) ?? 0) - (this.order.get(a.id) ?? 0));
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
