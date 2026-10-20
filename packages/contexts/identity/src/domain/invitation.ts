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
	email: string | null;
	claimedEmail: string | null;
	role: Role;
	sectionIds: string[];
	expiresAt: Date;
	acceptedAt: Date | null;
	invitedBy: string;
};

type CreateInput = {
	id: string;
	email?: string | null;
	role: Role;
	sectionIds?: string[];
	invitedBy: string;
	now: Date;
	validityDays?: number;
};

/**
 * Convite para entrar na redação.
 *
 * O identificador opaco é o token do link. Num convite nominal, o token só
 * funciona com o e-mail indicado; num link aberto, o primeiro e-mail que o
 * apresenta fica registrado em `claimedEmail`. Em ambos os casos o convite é
 * temporário e de uso único.
 *
 * E-mails são normalizados (minúsculas, aparados) porque são chaves de
 * comparação: "Joao@X.com" precisa casar com "joao@x.com".
 */
export class Invitation extends AggregateRoot<string> {
	private state: InvitationState;

	private constructor(id: string, state: InvitationState) {
		super(id);
		this.state = state;
	}

	static create(input: CreateInput): Result<Invitation, InvalidInviteEmail> {
		const email = input.email ? normalizeEmail(input.email) : null;
		if (email !== null && !EMAIL.test(email)) {
			return err(new InvalidInviteEmail(input.email as string));
		}

		const days = input.validityDays ?? INVITATION_VALIDITY_DAYS;
		const expiresAt = new Date(
			input.now.getTime() + days * 24 * 60 * 60 * 1000,
		);

		return ok(
			new Invitation(input.id, {
				email,
				claimedEmail: null,
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
			email: string | null;
			claimedEmail?: string | null;
			role: string;
			sectionIds: string[];
			expiresAt: Date;
			acceptedAt: Date | null;
			invitedBy: string;
		},
	): Invitation {
		return new Invitation(id, {
			email: state.email ? normalizeEmail(state.email) : null,
			claimedEmail: state.claimedEmail
				? normalizeEmail(state.claimedEmail)
				: null,
			role: (ROLES as readonly string[]).includes(state.role)
				? (state.role as Role)
				: "REDATOR",
			sectionIds: [...state.sectionIds],
			expiresAt: state.expiresAt,
			acceptedAt: state.acceptedAt,
			invitedBy: state.invitedBy,
		});
	}

	get email(): string | null {
		return this.state.email;
	}

	/** E-mail que apresentou o token. Em links abertos, é o primeiro cadastro. */
	get claimedEmail(): string | null {
		return this.state.claimedEmail;
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
			return err(
				new InvitationAlreadyAccepted(
					this.state.email ?? this.state.claimedEmail ?? "este link",
				),
			);
		}
		if (this.isExpired(now)) {
			return err(
				new InvitationExpired(
					this.state.email ?? this.state.claimedEmail ?? "este link",
				),
			);
		}
		this.state.acceptedAt = now;
		return ok(undefined);
	}
}

/** Minúsculas e aparado — o e-mail é chave de comparação, não texto livre. */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}
