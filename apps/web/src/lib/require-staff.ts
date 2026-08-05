import { resolveStaff } from "@portal-app/api/staff";
import { type Action, can } from "@portal-app/identity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Guard das rotas do painel.
 *
 * `cache()` deduplica a resolução dentro do mesmo request: o layout do dashboard
 * e a página que ele envolve chamam os dois, e sem isto seriam duas consultas de
 * sessão + duas do staff por navegação. Mesmo padrão do read model do portal.
 */
export const getStaff = cache(async () => resolveStaff(await headers()));

/**
 * Exige um membro ativo — e, opcionalmente, uma permissão. Sem sessão vai para o
 * login; autenticado mas sem permissão volta para a raiz do painel (e não para o
 * login, que daria a impressão errada de sessão expirada).
 *
 * Esta é a segunda barreira, não a única: quem manda é a checagem no router
 * tRPC. Aqui a autorização existe para não renderizar uma tela que o papel não
 * pode usar.
 */
export async function requireStaff(action?: Action) {
	const { session, staff } = await getStaff();

	if (!session?.user || !staff || !staff.isActive()) {
		redirect("/login");
	}

	if (action && !can(staff, action)) {
		redirect("/dashboard");
	}

	return { session, staff, user: session.user };
}
