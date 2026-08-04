import { type Action, can } from "@portal-app/identity";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

/** Exige uma sessão E um `StaffMember` ativo por trás dela. */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!ctx.staff || !ctx.staff.isActive()) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Requer um membro ativo da redação.",
		});
	}
	return next({
		ctx: {
			...ctx,
			staff: ctx.staff,
		},
	});
});

/**
 * Procedure que exige uma permissão de nível de ação (sem recurso). Para
 * checagens que dependem do recurso (autor/editoria), use `ctx.can(action, ref)`
 * dentro do resolver.
 */
export function requirePermission(action: Action) {
	return staffProcedure.use(({ ctx, next }) => {
		if (!can(ctx.staff, action)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Sem permissão para ${action}.`,
			});
		}
		return next({ ctx });
	});
}
