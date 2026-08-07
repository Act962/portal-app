import type { Program } from "../program";

/**
 * Porta de persistência do agregado `Program`. O domínio declara o contrato;
 * os adapters (Prisma em produção, in-memory nos testes) o implementam.
 */
export interface ProgramRepository {
	findById(id: string): Promise<Program | null>;
	save(program: Program): Promise<void>;
	delete(id: string): Promise<void>;
	list(): Promise<Program[]>;
}

/**
 * Implementação in-memory da porta. Mora junto do contrato — mesmo padrão de
 * `SectionRepository`/`StaffMemberRepository` — porque é o que legitima usar
 * um fake nos testes de aplicação: a mesma suíte de contrato roda contra ela e
 * contra o Prisma.
 */
export class InMemoryProgramRepository implements ProgramRepository {
	private readonly store = new Map<string, Program>();

	findById(id: string): Promise<Program | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	save(program: Program): Promise<void> {
		this.store.set(program.id, program);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}

	list(): Promise<Program[]> {
		// Mesma ordem que a grade do painel/portal usa: dia da semana, depois o
		// horário de início, depois `order` (desempate manual).
		const all = [...this.store.values()].sort(
			(a, b) =>
				a.dayOfWeek - b.dayOfWeek ||
				a.startTime.localeCompare(b.startTime) ||
				a.order - b.order,
		);
		return Promise.resolve(all);
	}

	clear(): void {
		this.store.clear();
	}
}
