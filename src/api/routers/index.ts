import { router } from "../trpc";
import { healthRouter } from "./health";
import { matrixRouter } from "./matrix";
import { metaRouter } from "./meta";
import { policiesRouter } from "./policies";
import { rolesRouter } from "./roles";
import { simulateRouter } from "./simulate";

export const appRouter = router({
	health: healthRouter,
	meta: metaRouter,
	matrix: matrixRouter,
	policies: policiesRouter,
	roles: rolesRouter,
	simulate: simulateRouter,
});

export type AppRouter = typeof appRouter;
