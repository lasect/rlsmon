import { z } from "zod";
import { type SimulationResult, simulateSelect } from "../../db/simulate";
import { publicProcedure, router } from "../trpc";

export const simulateRouter = router({
	select: publicProcedure
		.input(
			z.object({
				schema: z.string(),
				table: z.string(),
				role: z.string(),
				jwtClaims: z.record(z.unknown()).optional(),
			}),
		)
		.mutation(async ({ input }): Promise<SimulationResult> => {
			return simulateSelect(input.schema, input.table, {
				role: input.role,
				jwtClaims: input.jwtClaims,
			});
		}),
});
