import { router, staffProcedure } from "../index";

export const identityRouter = router({
	/** O membro por trás da sessão atual — papel, editorias e perfil. */
	me: staffProcedure.query(({ ctx }) => ({
		id: ctx.staff.id,
		email: ctx.staff.email,
		role: ctx.staff.role,
		sectionIds: [...ctx.staff.sectionIds],
	})),
});
