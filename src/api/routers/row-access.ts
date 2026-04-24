import { z } from "zod";
import {
	type CheckRowAccessResult,
	checkRowAccess,
	getTableRows,
	type SingleRoleCheckResult,
	type TableRowsResult,
} from "../../db/row-access";
import { publicProcedure, router } from "../trpc";

export const rowAccessRouter = router({
	getRows: publicProcedure
		.input(
			z.object({
				schema: z.string(),
				table: z.string(),
			}),
		)
		.query(async ({ input }): Promise<TableRowsResult> => {
			try {
				return await getTableRows(input.schema, input.table, 50);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new Error(`Failed to get rows: ${message}`);
			}
		}),

	checkAccess: publicProcedure
		.input(
			z.object({
				schema: z.string(),
				table: z.string(),
				pkValues: z.record(z.unknown()),
				jwtClaims: z.record(z.unknown()).optional(),
				role: z.string().optional(),
			}),
		)
		.mutation(
			async ({
				input,
			}): Promise<CheckRowAccessResult | SingleRoleCheckResult> => {
				try {
					const result = await checkRowAccess(
						input.schema,
						input.table,
						input.pkValues,
						input.jwtClaims,
						input.role,
					);
					if (result.error) {
						throw new Error(result.error);
					}
					return result;
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown error";
					throw new Error(`Failed to check access: ${message}`);
				}
			},
		),
});
