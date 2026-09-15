import { type Action, can, type ResourceRef } from "@portal-app/identity";
import type { NextRequest } from "next/server";

import { resolveStaff } from "./staff";

export async function createContext(req: NextRequest) {
	const { session, staff } = await resolveStaff(req.headers);

	return {
		session,
		staff,
		// Os cabeçalhos crus, para o raro procedimento que precisa de um cookie
		// próprio — o login da Meta guarda ali o token entre a volta do login e a
		// escolha da Página (spec 08, F4).
		headers: req.headers,
		can: (action: Action, resource?: ResourceRef): boolean =>
			staff !== null && can(staff, action, resource),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
