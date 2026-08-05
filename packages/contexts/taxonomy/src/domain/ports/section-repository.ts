import type { Section } from "../section";

/**
 * Porta de persistência do agregado `Section`. O domínio declara o contrato; os
 * adapters (Prisma em produção, in-memory nos testes) o implementam. `save` é um
 * upsert por id. `findBySlug` sustenta a invariante de unicidade que o próprio
 * agregado não pode verificar sozinho.
 */
export interface SectionRepository {
	findById(id: string): Promise<Section | null>;
	findBySlug(slug: string): Promise<Section | null>;
	save(section: Section): Promise<void>;
	delete(id: string): Promise<void>;
	list(): Promise<Section[]>;
}

/**
 * Implementação in-memory da porta. Mora junto do contrato porque é o que
 * legitima usar um fake nos testes de aplicação: a mesma suíte de contrato roda
 * contra ela e contra o Prisma.
 */
export class InMemorySectionRepository implements SectionRepository {
	private readonly store = new Map<string, Section>();

	findById(id: string): Promise<Section | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findBySlug(slug: string): Promise<Section | null> {
		for (const section of this.store.values()) {
			if (section.slug === slug) {
				return Promise.resolve(section);
			}
		}
		return Promise.resolve(null);
	}

	save(section: Section): Promise<void> {
		this.store.set(section.id, section);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}

	list(): Promise<Section[]> {
		// Ordenadas como o portal as mostra: por `order`, depois por nome.
		const all = [...this.store.values()].sort(
			(a, b) => a.order - b.order || a.name.localeCompare(b.name),
		);
		return Promise.resolve(all);
	}

	clear(): void {
		this.store.clear();
	}
}
