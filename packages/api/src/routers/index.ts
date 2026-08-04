import { protectedProcedure, publicProcedure, router } from "../index";
import { identityRouter } from "./identity";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	identity: identityRouter,
});
export type AppRouter = typeof appRouter;
