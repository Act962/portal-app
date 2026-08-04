import { err, ok, type Result } from "@portal-app/shared-kernel";

import type { AuthorProfile } from "../domain/author-profile";
import { can } from "../domain/authorization";
import { Forbidden, StaffNotFound } from "../domain/errors";
import type { StaffMemberRepository } from "../domain/ports/staff-repository";
import type { Role } from "../domain/role";
import type { StaffMember } from "../domain/staff-member";

type Deps = { repo: StaffMemberRepository };
type StaffResult = Result<StaffMember, Forbidden | StaffNotFound>;

/** Lista todos os membros — só quem gerencia usuários. */
export async function listStaff(
	actor: StaffMember,
	deps: Deps,
): Promise<Result<StaffMember[], Forbidden>> {
	if (!can(actor, "user:manage")) {
		return err(new Forbidden());
	}
	return ok(await deps.repo.list());
}

/** Altera o papel de um membro. */
export async function changeStaffRole(
	actor: StaffMember,
	input: { staffId: string; role: Role },
	deps: Deps,
): Promise<StaffResult> {
	return mutate(actor, input.staffId, deps, (staff) =>
		staff.changeRole(input.role),
	);
}

/** Vincula o membro às editorias informadas (relevante para o EDITOR). */
export async function bindStaffSections(
	actor: StaffMember,
	input: { staffId: string; sectionIds: readonly string[] },
	deps: Deps,
): Promise<StaffResult> {
	return mutate(actor, input.staffId, deps, (staff) =>
		staff.bindSections(input.sectionIds),
	);
}

/** Desativa o membro: revoga o acesso, preserva a autoria (o id continua). */
export async function deactivateStaff(
	actor: StaffMember,
	input: { staffId: string },
	deps: Deps,
): Promise<StaffResult> {
	return mutate(actor, input.staffId, deps, (staff) => staff.deactivate());
}

/**
 * Edita o perfil de autor. Diferente das demais: o próprio membro pode editar o
 * seu; para editar o de outro é preciso gerenciar usuários.
 */
export async function updateAuthorProfile(
	actor: StaffMember,
	input: { staffId: string; profile: AuthorProfile },
	deps: Deps,
): Promise<StaffResult> {
	const isSelf = actor.id === input.staffId;
	if (!isSelf && !can(actor, "user:manage")) {
		return err(new Forbidden());
	}
	const staff = await deps.repo.findById(input.staffId);
	if (!staff) {
		return err(new StaffNotFound(input.staffId));
	}
	staff.updateProfile(input.profile);
	await deps.repo.save(staff);
	return ok(staff);
}

async function mutate(
	actor: StaffMember,
	staffId: string,
	deps: Deps,
	change: (staff: StaffMember) => void,
): Promise<StaffResult> {
	if (!can(actor, "user:manage")) {
		return err(new Forbidden());
	}
	const staff = await deps.repo.findById(staffId);
	if (!staff) {
		return err(new StaffNotFound(staffId));
	}
	change(staff);
	await deps.repo.save(staff);
	return ok(staff);
}
