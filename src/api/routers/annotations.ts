import { z } from "zod";
import {
	type Annotation,
	deleteAnnotation,
	getAnnotation,
	readAnnotations,
	setAnnotation,
} from "../../annotations/storage";
import { publicProcedure, router } from "../trpc";

export const annotationsRouter = router({
	list: publicProcedure.query(async () => {
		const annotations = readAnnotations();
		const result: Array<
			{
				key: string;
				schema: string;
				table: string;
				policy: string;
			} & Annotation
		> = [];

		for (const [key, annotation] of Object.entries(annotations)) {
			const parts = key.split(".");
			if (parts.length === 3) {
				result.push({
					key,
					schema: parts[0] ?? "",
					table: parts[1] ?? "",
					policy: parts[2] ?? "",
					...annotation,
				});
			}
		}

		return result;
	}),

	get: publicProcedure
		.input(
			z.object({ schema: z.string(), table: z.string(), policy: z.string() }),
		)
		.query(async ({ input }): Promise<Annotation | null> => {
			return getAnnotation(input.schema, input.table, input.policy);
		}),

	set: publicProcedure
		.input(
			z.object({
				schema: z.string(),
				table: z.string(),
				policy: z.string(),
				note: z.string().optional(),
				owner: z.string().optional(),
				status: z.enum(["reviewed", "needs-attention", "approved"]).optional(),
			}),
		)
		.mutation(async ({ input }): Promise<Annotation> => {
			return setAnnotation(input.schema, input.table, input.policy, input);
		}),

	delete: publicProcedure
		.input(
			z.object({ schema: z.string(), table: z.string(), policy: z.string() }),
		)
		.mutation(async ({ input }): Promise<void> => {
			deleteAnnotation(input.schema, input.table, input.policy);
		}),
});
