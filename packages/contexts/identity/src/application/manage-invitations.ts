import type { Clock, IdGenerator, Result } from "@portal-app/shared-kernel";
import { err, ok } from "@portal-app/shared-kernel";

import type {
	InvalidInviteEmail,
	InvitationAlreadyAccepted,
	InvitationExpired,
} from "../domain/errors";
import { InvitationAlreadyExists, NotInvited } from "../domain/errors";
import { Invitation, normalizeEmail } from "../domain/invitation";
import type { InvitationRepository } from "../domain/ports/invitation-repository";
import type { Mailer } from "../domain/ports/mailer";
import type { StaffMemberRepository } from "../domain/ports/staff-repository";
import type { Role } from "../domain/role";

/**
 * Casos de uso dos convites. A AUTORIZAÇÃO fica na fronteira da API
 * (`requirePermission("user:manage")`) — mesmo arranjo dos demais contextos.
 */
type Deps = {
	invitations: InvitationRepository;
	clock: Clock;
	ids: IdGenerator;
	mailer: Mailer;
	/** Origem do painel, para compor o link de login no e-mail (ex: BETTER_AUTH_URL). */
	appUrl: string;
};

export function listInvitations(
	deps: Pick<Deps, "invitations">,
): Promise<Invitation[]> {
	return deps.invitations.list();
}

export async function inviteMember(
	input: { email: string; role: Role; sectionIds?: string[] },
	invitedBy: string,
	deps: Deps,
): Promise<Result<Invitation, InvalidInviteEmail | InvitationAlreadyExists>> {
	const now = deps.clock.now();
	const email = normalizeEmail(input.email);

	// Dois convites abertos para a mesma pessoa não fazem mal, mas confundem a
	// lista e o revogar — melhor recusar e mandar revogar o anterior.
	const existing = await deps.invitations.findOpenByEmail(email, now);
	if (existing) {
		return err(new InvitationAlreadyExists(email));
	}

	const invitation = Invitation.create({
		id: deps.ids.generate(),
		email,
		role: input.role,
		sectionIds: input.sectionIds,
		invitedBy,
		now,
	});
	if (invitation.isErr()) {
		return invitation;
	}

	await deps.invitations.save(invitation.unwrap());

	// Sem Mailer configurado isto é um NoopMailer — não falha, só não faz nada,
	// e o "avise você mesmo" que já existe continua sendo o caminho.
	await deps.mailer.send({
		to: email,
		subject: "Convite para a redação",
		text: `Você foi convidado para o painel da redação. Crie sua conta em ${deps.appUrl}/login usando exatamente este e-mail (${email}).`,
	});

	return invitation;
}

export async function revokeInvitation(
	id: string,
	deps: Pick<Deps, "invitations">,
): Promise<void> {
	await deps.invitations.delete(id);
}

/**
 * O PORTÃO do cadastro. Devolve o convite aberto para o e-mail, ou `NotInvited`.
 *
 * A exceção do primeiro usuário vive aqui e não no chamador porque é a mesma
 * regra: "quem pode entrar". Sem ela o sistema ficaria trancado para fora de si
 * mesmo — não haveria como criar o primeiro ADMIN, que é quem convida todo o
 * resto.
 */
export async function assertCanSignUp(
	email: string,
	deps: Pick<Deps, "invitations" | "clock"> & { staff: StaffMemberRepository },
): Promise<Result<Invitation | null, NotInvited>> {
	if ((await deps.staff.count()) === 0) {
		return ok(null);
	}

	const invitation = await deps.invitations.findOpenByEmail(
		normalizeEmail(email),
		deps.clock.now(),
	);

	return invitation ? ok(invitation) : err(new NotInvited());
}

/** Marca o convite como usado, depois que a conta nasceu. */
export async function acceptInvitation(
	invitation: Invitation,
	deps: Pick<Deps, "invitations" | "clock">,
): Promise<Result<void, InvitationAlreadyAccepted | InvitationExpired>> {
	const accepted = invitation.accept(deps.clock.now());
	if (accepted.isErr()) {
		return accepted;
	}
	await deps.invitations.save(invitation);
	return ok(undefined);
}
