import { protectedProcedure, publicProcedure, router } from "../index";
import { editorialRouter } from "./editorial";
import { identityRouter } from "./identity";
import { mediaRouter } from "./media";
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
	media: mediaRouter,
	editorial: editorialRouter,
});
export type AppRouter = typeof appRouter;
