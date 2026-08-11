import { protectedProcedure, publicProcedure, router } from "../index";
import { analyticsRouter } from "./analytics";
import { broadcastRouter } from "./broadcast";
import { columnistsRouter } from "./columnists";
import { editorialRouter } from "./editorial";
import { identityRouter } from "./identity";
import { mediaRouter } from "./media";
import { pollsRouter } from "./polls";
import { settingsRouter } from "./settings";
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
	settings: settingsRouter,
	broadcast: broadcastRouter,
	columnists: columnistsRouter,
	analytics: analyticsRouter,
	polls: pollsRouter,
});
export type AppRouter = typeof appRouter;
