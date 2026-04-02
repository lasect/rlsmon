import { z } from "zod";
import { getRoles, type RoleInfo } from "../../db/catalog";
import { publicProcedure, router } from "../trpc";

export const rolesRouter = router({
	list: publicProcedure.query(async (): Promise<RoleInfo[]> => {
		return getRoles();
	}),

	get: publicProcedure
		.input(z.object({ name: z.string() }))
		.query(async ({ input }): Promise<RoleInfo | null> => {
			const roles = await getRoles();
			return roles.find((r) => r.name === input.name) ?? null;
		}),
});
