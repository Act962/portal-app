import type { Columnist } from "../columnist";

/**
 * Porta de persistência do agregado `Columnist`. O domínio declara o contrato;
 * os adapters (Prisma em produção, in-memory nos testes) o implementam.
 */
export interface ColumnistRepository {
	findById(id: string): Promise<Columnist | null>;
	/** Usado para barrar assinatura repetida antes de gravar. */
	findBySlug(slug: string): Promise<Columnist | null>;
	save(columnist: Columnist): Promise<void>;
	delete(id: string): Promise<void>;
	/** Todos, ativos e inativos — o painel precisa dos dois. */
	list(): Promise<Columnist[]>;
}

/**
 * Implementação in-memory da porta. Mora junto do contrato — mesmo padrão de
 * `ProgramRepository`/`StaffMemberRepository` — porque é o que legitima usar
 * um fake nos testes de aplicação: a mesma suíte de contrato roda contra ela e
 * contra o Prisma.
 */
export class InMemoryColumnistRepository implements ColumnistRepository {
	private readonly store = new Map<string, Columnist>();

	findById(id: string): Promise<Columnist | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findBySlug(slug: string): Promise<Columnist | null> {
		const found = [...this.store.values()].find((c) => c.slug === slug);
		return Promise.resolve(found ?? null);
	}

	save(columnist: Columnist): Promise<void> {
		this.store.set(columnist.id, columnist);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}

	list(): Promise<Columnist[]> {
		// Mesma ordem do bloco da home: `order` manual e, no empate, o nome —
		// sem o desempate estável a grade trocaria de ordem a cada consulta.
		const all = [...this.store.values()].sort(
			(a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"),
		);
		return Promise.resolve(all);
	}

	clear(): void {
		this.store.clear();
	}
}
