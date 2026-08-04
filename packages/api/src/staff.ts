import { auth } from "@portal-app/auth";
import { createPrismaClient } from "@portal-app/db";
import {
	provisionStaffForNewUser,
	type StaffMember,
} from "@portal-app/identity";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";

/**
 * Raiz de composição da identidade no lado servidor. É AQUI (na camada de API,
 * não em `apps/web`) que a infraestrutura do contexto é instanciada, para o app
 * consumir só isto — mantendo a regra `infra-nao-vaza` satisfazível quando o
 * `apps/web` entrar no scan do dependency-cruiser (Etapa 5).
 */
export const staffRepo = new PrismaStaffRepository(createPrismaClient());

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Resolve a sessão do Better-Auth e o `StaffMember` correspondente. Se o usuário
 * está autenticado mas ainda não tem staff (primeiro acesso), provisiona na hora
 * — o primeiro do sistema nasce ADMIN (Decisão D2). É idempotente e vive no
 * caminho de resolução justamente para não depender do timing de um hook.
 */
export async function resolveStaff(
	headers: Headers,
): Promise<{ session: Session; staff: StaffMember | null }> {
	const session = await auth.api.getSession({ headers });
	if (!session?.user) {
		return { session, staff: null };
	}

	const existing = await staffRepo.findById(session.user.id);
	const staff =
		existing ??
		(await provisionStaffForNewUser(
			{ userId: session.user.id, email: session.user.email },
			{ repo: staffRepo },
		));

	return { session, staff };
}
