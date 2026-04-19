import { z } from "zod";
import {
	checkMigrationSafety,
	type ParsedMigration,
	parseMigrationSQL,
	type SafetyResult,
} from "../../db/migration-check";
import { publicProcedure, router } from "../trpc";

export const migrationCheckRouter = router({
	check: publicProcedure
		.input(z.object({ sql: z.string(), snapshotId: z.string().optional() }))
		.mutation(async ({ input }): Promise<SafetyResult> => {
			return checkMigrationSafety(input.sql, input.snapshotId);
		}),

	parse: publicProcedure
		.input(z.object({ sql: z.string() }))
		.mutation(async ({ input }): Promise<ParsedMigration> => {
			return parseMigrationSQL(input.sql);
		}),
});
