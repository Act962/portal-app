import type { StaffMemberRepository } from "../domain/ports/staff-repository";
import { StaffMember } from "../domain/staff-member";

/**
 * Cria o `StaffMember` que espelha um novo usuário do Better-Auth. O PRIMEIRO
 * membro do sistema nasce `ADMIN` (destrava o painel — Decisão D2 da spec); os
 * seguintes nascem `REDATOR` e têm o papel ajustado por um admin via convite
 * (Etapa 4). Idempotente: se o staff já existe, apenas o devolve.
 *
 * Camada de aplicação: depende só do domínio e da porta — nunca do adapter
 * Prisma. É o `dependency-cruiser` (regra `aplicacao-nao-importa-infra`) que
 * garante isso.
 */
export async function provisionStaffForNewUser(
	input: { userId: string; email: string },
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
		role: isFirst ? "ADMIN" : "REDATOR",
	});

	await deps.repo.save(staff);
	return staff;
}
