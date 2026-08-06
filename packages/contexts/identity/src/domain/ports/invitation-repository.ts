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
