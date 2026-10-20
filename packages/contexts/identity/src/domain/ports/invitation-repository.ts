import { Invitation } from "../invitation";

/**
 * Porta de persistência dos convites.
 *
 * `claimById` sustenta o portão do cadastro: reserva atomicamente o token para
 * um e-mail normalizado. `findClaimedByEmail` recupera o convite no primeiro
 * acesso autenticado, quando o membro da redação é provisionado.
 */
export type InvitationRepository = {
	findById(id: string): Promise<Invitation | null>;
	findOpenByEmail(email: string, now: Date): Promise<Invitation | null>;
	findClaimedByEmail(email: string, now: Date): Promise<Invitation | null>;
	claimById(id: string, email: string, now: Date): Promise<Invitation | null>;
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

	findClaimedByEmail(email: string, now: Date): Promise<Invitation | null> {
		for (const invitation of this.store.values()) {
			if (invitation.claimedEmail === email && invitation.isOpen(now)) {
				return Promise.resolve(invitation);
			}
		}
		return Promise.resolve(null);
	}

	claimById(id: string, email: string, now: Date): Promise<Invitation | null> {
		const invitation = this.store.get(id);
		if (!invitation?.isOpen(now)) {
			return Promise.resolve(null);
		}
		if (invitation.email && invitation.email !== email) {
			return Promise.resolve(null);
		}
		if (invitation.claimedEmail && invitation.claimedEmail !== email) {
			return Promise.resolve(null);
		}
		const claimed = Invitation.fromPersistence(invitation.id, {
			email: invitation.email,
			claimedEmail: email,
			role: invitation.role,
			sectionIds: [...invitation.sectionIds],
			expiresAt: invitation.expiresAt,
			acceptedAt: invitation.acceptedAt,
			invitedBy: invitation.invitedBy,
		});
		this.store.set(id, claimed);
		return Promise.resolve(claimed);
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
