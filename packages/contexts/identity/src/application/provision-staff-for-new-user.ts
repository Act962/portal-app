import type { StaffMemberRepository } from "../domain/ports/staff-repository";
import type { Role } from "../domain/role";
import { StaffMember } from "../domain/staff-member";

/**
 * Cria o membro da redação correspondente a um usuário recém-autenticado.
 *
 * O PRIMEIRO usuário do sistema nasce ADMIN (Decisão D2 da Fase 1) — sem isso o
 * sistema ficaria trancado para fora de si mesmo, porque não haveria quem
 * convidasse. Os demais nascem com o papel do CONVITE que autorizou o cadastro;
 * o `REDATOR` só permanece como piso defensivo, para o caso de chegar aqui sem
 * convite (o que o portão do Better Auth já impede).
 *
 * Idempotente: chamado no caminho de resolução da sessão, não num hook, para não
 * depender de timing.
 */
export async function provisionStaffForNewUser(
	input: {
		userId: string;
		email: string;
		role?: Role;
		sectionIds?: readonly string[];
	},
	deps: { repo: StaffMemberRepository },
): Promise<StaffMember> {
	const existing = await deps.repo.findById(input.userId);
	if (existing) {
		return existing;
	}

	const isFirst = (await deps.repo.count()) === 0;
	const staff = StaffMember.create({
		id: input.userId,
		email: input.email,
		role: isFirst ? "ADMIN" : (input.role ?? "REDATOR"),
		sectionIds: isFirst ? [] : input.sectionIds,
	});

	await deps.repo.save(staff);
	return staff;
}
