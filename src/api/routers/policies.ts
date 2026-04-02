import { z } from "zod";
import { getPolicies, type PolicyInfo } from "../../db/catalog";
import { publicProcedure, router } from "../trpc";

export const policiesRouter = router({
	list: publicProcedure.query(async (): Promise<PolicyInfo[]> => {
		return getPolicies();
	}),

	getByTable: publicProcedure
		.input(
			z.object({
				schema: z.string(),
				table: z.string(),
			}),
		)
		.query(async ({ input }): Promise<PolicyInfo[]> => {
			const policies = await getPolicies();
			return policies.filter(
				(p) => p.schema === input.schema && p.table === input.table,
			);
		}),
});
