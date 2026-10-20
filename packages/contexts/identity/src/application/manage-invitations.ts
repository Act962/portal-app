import type { Clock, IdGenerator, Result } from "@portal-app/shared-kernel";
import { err, ok } from "@portal-app/shared-kernel";

import type {
	InvalidInviteEmail,
	InvitationAlreadyAccepted,
	InvitationExpired,
} from "../domain/errors";
import {
	EditorRequiresSection,
	InvitationAlreadyExists,
	NotInvited,
} from "../domain/errors";
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
	input: {
		email?: string | null;
		role: Role;
		sectionIds?: string[];
		validityDays?: number;
	},
	invitedBy: string,
	deps: Deps,
): Promise<
	Result<
		Invitation,
		InvalidInviteEmail | InvitationAlreadyExists | EditorRequiresSection
	>
> {
	if (input.role === "EDITOR" && (input.sectionIds?.length ?? 0) === 0) {
		return err(new EditorRequiresSection());
	}
	const now = deps.clock.now();
	const email = input.email ? normalizeEmail(input.email) : null;

	// Dois convites abertos para a mesma pessoa não fazem mal, mas confundem a
	// lista e o revogar — melhor recusar e mandar revogar o anterior.
	const existing = email
		? await deps.invitations.findOpenByEmail(email, now)
		: null;
	if (existing && email) {
		return err(new InvitationAlreadyExists(email));
	}

	const invitation = Invitation.create({
		id: deps.ids.generate(),
		email,
		role: input.role,
		sectionIds: input.role === "EDITOR" ? input.sectionIds : [],
		invitedBy,
		now,
		validityDays: input.validityDays,
	});
	if (invitation.isErr()) {
		return invitation;
	}

	await deps.invitations.save(invitation.unwrap());

	// Sem Mailer configurado isto é um NoopMailer — não falha, só não faz nada,
	// e o "avise você mesmo" que já existe continua sendo o caminho.
	if (email) {
		const url = `${deps.appUrl}/login?invite=${invitation.unwrap().id}&modo=criar`;
		await deps.mailer.send({
			to: email,
			subject: "Convite para a redação",
			text: `Você foi convidado para o painel da redação. Crie sua conta em ${url} usando exatamente este e-mail (${email}).`,
		});
	}

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
	invitationId: string | null,
	deps: Pick<Deps, "invitations" | "clock"> & { staff: StaffMemberRepository },
): Promise<Result<Invitation | null, NotInvited>> {
	if ((await deps.staff.count()) === 0) {
		return ok(null);
	}

	if (!invitationId) {
		return err(new NotInvited());
	}

	const invitation = await deps.invitations.claimById(
		invitationId,
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
