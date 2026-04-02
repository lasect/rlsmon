import { getMeta, type MetaData } from "../../db/catalog";
import { publicProcedure, router } from "../trpc";

export const metaRouter = router({
	get: publicProcedure.query(async (): Promise<MetaData> => {
		return getMeta();
	}),
});
