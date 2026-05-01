import { router } from "../trpc";
import { aiRouter } from "./ai";
import { annotationsRouter } from "./annotations";
import { auditRouter } from "./audit";
import { healthRouter } from "./health";
import { matrixRouter } from "./matrix";
import { metaRouter } from "./meta";
import { migrationCheckRouter } from "./migration-check";
import { policiesRouter } from "./policies";
import { rolesRouter } from "./roles";
import { rowAccessRouter } from "./row-access";
import { settingsRouter } from "./settings";
import { simulateRouter } from "./simulate";
import { snapshotsRouter } from "./snapshots";

export const appRouter = router({
	ai: aiRouter,
	health: healthRouter,
	meta: metaRouter,
	matrix: matrixRouter,
	policies: policiesRouter,
	roles: rolesRouter,
	simulate: simulateRouter,
	audit: auditRouter,
	rowAccess: rowAccessRouter,
	snapshots: snapshotsRouter,
	migrationCheck: migrationCheckRouter,
	annotations: annotationsRouter,
	settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
