import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	InvalidInviteEmail,
	InvitationAlreadyAccepted,
	InvitationExpired,
} from "./errors";
import { ROLES, type Role } from "./role";

/** Validade padrão do convite. Curta de propósito: convite esquecido num
 * histórico de conversa é porta aberta, e reenviar custa um clique. */
export const INVITATION_VALIDITY_DAYS = 7;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InvitationState = {
	email: string;
	role: Role;
	sectionIds: string[];
	expiresAt: Date;
	acceptedAt: Date | null;
	invitedBy: string;
};

type CreateInput = {
	id: string;
	email: string;
	role: Role;
	sectionIds?: string[];
	invitedBy: string;
	now: Date;
	validityDays?: number;
};

/**
 * Convite para entrar na redação.
 *
 * **O portão é o e-mail** (decisão do cliente): quem se cadastra com um e-mail
 * convidado entra; qualquer outro é recusado. Não há token no link — o que
 * significa que o convite não vaza por encaminhamento de mensagem, e que o
 * endereço do painel pode ser público sem virar cadastro aberto.
 *
 * O e-mail é normalizado (minúsculas, aparado) porque é chave de comparação: um
 * convite para "Joao@X.com" precisa casar com um cadastro em "joao@x.com", ou o
 * convite simplesmente não funciona e ninguém entende por quê.
 */
export class Invitation extends AggregateRoot<string> {
	private state: InvitationState;

	private constructor(id: string, state: InvitationState) {
		super(id);
		this.state = state;
	}

	static create(input: CreateInput): Result<Invitation, InvalidInviteEmail> {
		const email = normalizeEmail(input.email);
		if (!EMAIL.test(email)) {
			return err(new InvalidInviteEmail(input.email));
		}

		const days = input.validityDays ?? INVITATION_VALIDITY_DAYS;
		const expiresAt = new Date(
			input.now.getTime() + days * 24 * 60 * 60 * 1000,
		);

		return ok(
			new Invitation(input.id, {
				email,
				role: input.role,
				sectionIds: [...(input.sectionIds ?? [])],
				expiresAt,
				acceptedAt: null,
				invitedBy: input.invitedBy,
			}),
		);
	}

	/** Reidrata do banco. Não valida: o que já está guardado não se recusa. */
	static fromPersistence(
		id: string,
		state: {
			email: string;
			role: string;
			sectionIds: string[];
			expiresAt: Date;
			acceptedAt: Date | null;
			invitedBy: string;
		},
	): Invitation {
		return new Invitation(id, {
			email: normalizeEmail(state.email),
			role: (ROLES as readonly string[]).includes(state.role)
				? (state.role as Role)
				: "REDATOR",
			sectionIds: [...state.sectionIds],
			expiresAt: state.expiresAt,
			acceptedAt: state.acceptedAt,
			invitedBy: state.invitedBy,
		});
	}

	get email(): string {
		return this.state.email;
	}

	get role(): Role {
		return this.state.role;
	}

	get sectionIds(): readonly string[] {
		return this.state.sectionIds;
	}

	get expiresAt(): Date {
		return this.state.expiresAt;
	}

	get acceptedAt(): Date | null {
		return this.state.acceptedAt;
	}

	get invitedBy(): string {
		return this.state.invitedBy;
	}

	isAccepted(): boolean {
		return this.state.acceptedAt !== null;
	}

	isExpired(now: Date): boolean {
		return now.getTime() >= this.state.expiresAt.getTime();
	}

	/** Aberto = ainda vale para alguém se cadastrar. */
	isOpen(now: Date): boolean {
		return !this.isAccepted() && !this.isExpired(now);
	}

	/**
	 * Consome o convite. Erra em vez de ignorar: aceitar duas vezes ou aceitar
	 * vencido são situações diferentes, e quem chama precisa distinguir para dar
	 * a mensagem certa a quem está tentando entrar.
	 */
	accept(
		now: Date,
	): Result<void, InvitationAlreadyAccepted | InvitationExpired> {
		if (this.isAccepted()) {
			return err(new InvitationAlreadyAccepted(this.state.email));
		}
		if (this.isExpired(now)) {
			return err(new InvitationExpired(this.state.email));
		}
		this.state.acceptedAt = now;
		return ok(undefined);
	}
}

/** Minúsculas e aparado — o e-mail é chave de comparação, não texto livre. */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}
