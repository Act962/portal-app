import { type Action, can, type ResourceRef } from "@portal-app/identity";
import type { NextRequest } from "next/server";

import { resolveStaff } from "./staff";

export async function createContext(req: NextRequest) {
	const { session, staff } = await resolveStaff(req.headers);

	return {
		session,
		staff,
		can: (action: Action, resource?: ResourceRef): boolean =>
			staff !== null && can(staff, action, resource),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
