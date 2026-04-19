import { z } from "zod";
import { captureSnapshot } from "../../snapshots/capture";
import { diffSnapshots } from "../../snapshots/diff";
import {
	deleteSnapshot,
	getSnapshot,
	listSnapshots,
	renameSnapshot,
	type SnapshotMeta,
	saveSnapshot,
} from "../../snapshots/storage";
import { publicProcedure, router } from "../trpc";

export const snapshotsRouter = router({
	list: publicProcedure.query(async (): Promise<SnapshotMeta[]> => {
		return listSnapshots();
	}),

	get: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }): Promise<SnapshotMeta | null> => {
			const snapshot = getSnapshot(input.id);
			if (!snapshot) return null;
			return {
				id: snapshot.id,
				label: snapshot.label,
				createdAt: snapshot.createdAt,
				tableCount: snapshot.tables?.length ?? 0,
				policyCount: snapshot.policies?.length ?? 0,
				roleCount: snapshot.roles?.length ?? 0,
			};
		}),

	create: publicProcedure
		.input(z.object({ label: z.string().optional() }))
		.mutation(async ({ input }): Promise<SnapshotMeta> => {
			const snapshot = await captureSnapshot(input.label);
			saveSnapshot(snapshot);
			return {
				id: snapshot.id,
				label: snapshot.label,
				createdAt: snapshot.createdAt,
				tableCount: snapshot.tables?.length ?? 0,
				policyCount: snapshot.policies?.length ?? 0,
				roleCount: snapshot.roles?.length ?? 0,
			};
		}),

	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }): Promise<void> => {
			deleteSnapshot(input.id);
		}),

	rename: publicProcedure
		.input(z.object({ id: z.string(), label: z.string() }))
		.mutation(async ({ input }): Promise<void> => {
			renameSnapshot(input.id, input.label);
		}),

	diff: publicProcedure
		.input(z.object({ idA: z.string(), idB: z.string() }))
		.query(async ({ input }) => {
			const snapshotA = getSnapshot(input.idA);
			const snapshotB = getSnapshot(input.idB);
			if (!snapshotA || !snapshotB) {
				throw new Error("Snapshot not found");
			}
			return diffSnapshots(snapshotA, snapshotB);
		}),
});
