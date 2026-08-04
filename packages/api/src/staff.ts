import { auth } from "@portal-app/auth";
import { createPrismaClient } from "@portal-app/db";
import type { StaffMember } from "@portal-app/identity";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";

/**
 * Raiz de composição da identidade no lado servidor. É AQUI (na camada de API,
 * não em `apps/web`) que a infraestrutura do contexto é instanciada, para o app
 * consumir só isto — mantendo a regra `infra-nao-vaza` satisfazível quando o
 * `apps/web` entrar no scan do dependency-cruiser (Etapa 5).
 */
const staffRepo = new PrismaStaffRepository(createPrismaClient());

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/** Resolve a sessão do Better-Auth e o `StaffMember` correspondente. */
export async function resolveStaff(
	headers: Headers,
): Promise<{ session: Session; staff: StaffMember | null }> {
	const session = await auth.api.getSession({ headers });
	const staff = session?.user
		? await staffRepo.findById(session.user.id)
		: null;
	return { session, staff };
}
