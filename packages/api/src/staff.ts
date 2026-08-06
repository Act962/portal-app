import { auth } from "@portal-app/auth";
import { createPrismaClient } from "@portal-app/db";
import {
	acceptInvitation,
	provisionStaffForNewUser,
	type StaffMember,
} from "@portal-app/identity";
import { PrismaInvitationRepository } from "@portal-app/identity/infrastructure/prisma-invitation-repository";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";
import { SystemClock } from "@portal-app/shared-kernel";

/**
 * Raiz de composição da identidade no lado servidor. É AQUI (na camada de API,
 * não em `apps/web`) que a infraestrutura do contexto é instanciada, para o app
 * consumir só isto — mantendo a regra `infra-nao-vaza` satisfazível quando o
 * `apps/web` entrar no scan do dependency-cruiser (Etapa 5).
 */
const prisma = createPrismaClient();

export const staffRepo = new PrismaStaffRepository(prisma);
export const invitationRepo = new PrismaInvitationRepository(prisma);

export const invitationDeps = {
	invitations: invitationRepo,
	clock: new SystemClock(),
};

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Resolve a sessão do Better-Auth e o `StaffMember` correspondente. Se o usuário
 * está autenticado mas ainda não tem staff (primeiro acesso), provisiona na hora
 * — o primeiro do sistema nasce ADMIN (Decisão D2). É idempotente e vive no
 * caminho de resolução justamente para não depender do timing de um hook.
 *
 * O papel vem do CONVITE que autorizou o cadastro, e o convite é consumido logo
 * depois. Quem barra quem não tem convite é o `databaseHooks` do Better Auth
 * (`packages/auth`), antes da conta existir; aqui só se lê o que ele já validou.
 */
export async function resolveStaff(
	headers: Headers,
): Promise<{ session: Session; staff: StaffMember | null }> {
	const session = await auth.api.getSession({ headers });
	if (!session?.user) {
		return { session, staff: null };
	}

	const existing = await staffRepo.findById(session.user.id);
	if (existing) {
		return { session, staff: existing };
	}

	const invitation = await invitationRepo.findOpenByEmail(
		session.user.email.trim().toLowerCase(),
		invitationDeps.clock.now(),
	);

	const staff = await provisionStaffForNewUser(
		{
			userId: session.user.id,
			email: session.user.email,
			role: invitation?.role,
			sectionIds: invitation?.sectionIds,
		},
		{ repo: staffRepo },
	);

	// Consumir DEPOIS de provisionar: se algo falhar no meio, o convite continua
	// aberto e a pessoa tenta de novo — melhor do que queimar o convite e deixar
	// alguém sem acesso e sem como voltar.
	if (invitation) {
		await acceptInvitation(invitation, invitationDeps);
	}

	return { session, staff };
}
