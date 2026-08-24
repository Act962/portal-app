import type { Tag } from "../tag";

/**
 * Porta de persistência do agregado `Tag`. Mesmo desenho da de editorias:
 * `save` é upsert por id, `findBySlug` sustenta a unicidade do slug.
 */
export interface TagRepository {
	findById(id: string): Promise<Tag | null>;
	findBySlug(slug: string): Promise<Tag | null>;
	save(tag: Tag): Promise<void>;
	delete(id: string): Promise<void>;
	list(): Promise<Tag[]>;
}

/** Fake in-memory da porta — roda no mesmo contrato que o adapter Prisma. */
export class InMemoryTagRepository implements TagRepository {
	private readonly store = new Map<string, Tag>();

	findById(id: string): Promise<Tag | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findBySlug(slug: string): Promise<Tag | null> {
		for (const tag of this.store.values()) {
			if (tag.slug === slug) {
				return Promise.resolve(tag);
			}
		}
		return Promise.resolve(null);
	}

	save(tag: Tag): Promise<void> {
		this.store.set(tag.id, tag);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}

	list(): Promise<Tag[]> {
		const all = [...this.store.values()].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		return Promise.resolve(all);
	}

	clear(): void {
		this.store.clear();
	}
}
