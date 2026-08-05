import { protectedProcedure, publicProcedure, router } from "../index";
import { identityRouter } from "./identity";
import { taxonomyRouter } from "./taxonomy";

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
	taxonomy: taxonomyRouter,
});
export type AppRouter = typeof appRouter;
