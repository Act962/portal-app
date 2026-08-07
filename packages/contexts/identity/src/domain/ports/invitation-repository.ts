import type { Invitation } from "../invitation";

/**
 * Porta de persistência dos convites.
 *
 * `findOpenByEmail` é o método que sustenta o portão do cadastro: recebe o
 * e-mail já normalizado e devolve o convite que ainda vale, se houver.
 */
export type InvitationRepository = {
	findById(id: string): Promise<Invitation | null>;
	findOpenByEmail(email: string, now: Date): Promise<Invitation | null>;
	list(): Promise<Invitation[]>;
	save(invitation: Invitation): Promise<void>;
	delete(id: string): Promise<void>;
};

/** Fake in-memory da porta, para os testes de aplicação. */
export class InMemoryInvitationRepository implements InvitationRepository {
	private readonly store = new Map<string, Invitation>();

	findById(id: string): Promise<Invitation | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	findOpenByEmail(email: string, now: Date): Promise<Invitation | null> {
		for (const invitation of this.store.values()) {
			if (invitation.email === email && invitation.isOpen(now)) {
				return Promise.resolve(invitation);
			}
		}
		return Promise.resolve(null);
	}

	list(): Promise<Invitation[]> {
		return Promise.resolve([...this.store.values()]);
	}

	save(invitation: Invitation): Promise<void> {
		this.store.set(invitation.id, invitation);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}
}
