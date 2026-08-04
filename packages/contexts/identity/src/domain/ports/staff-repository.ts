import type { StaffMember } from "../staff-member";

/**
 * Porta de persistência do agregado `StaffMember`. O domínio declara o
 * contrato; os adapters (Prisma em produção, in-memory nos testes) o
 * implementam. `save` é um upsert por id — a criação e a atualização usam o
 * mesmo caminho.
 */
export interface StaffMemberRepository {
	findById(id: string): Promise<StaffMember | null>;
	findByEmail(email: string): Promise<StaffMember | null>;
	save(staff: StaffMember): Promise<void>;
	list(): Promise<StaffMember[]>;
}

/**
 * Implementação in-memory da porta. Mora junto do contrato (como os test
 * doubles do shared-kernel) porque é o que legitima usar um fake nos testes de
 * aplicação: a mesma suíte de contrato roda contra ela e contra o Prisma.
 */
export class InMemoryStaffRepository implements StaffMemberRepository {
	private readonly store = new Map<string, StaffMember>();

	findById(id: string): Promise<StaffMember | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findByEmail(email: string): Promise<StaffMember | null> {
		for (const staff of this.store.values()) {
			if (staff.email === email) {
				return Promise.resolve(staff);
			}
		}
		return Promise.resolve(null);
	}

	save(staff: StaffMember): Promise<void> {
		this.store.set(staff.id, staff);
		return Promise.resolve();
	}

	list(): Promise<StaffMember[]> {
		return Promise.resolve([...this.store.values()]);
	}

	clear(): void {
		this.store.clear();
	}
}
