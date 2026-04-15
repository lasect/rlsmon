import { type AuditResult, runAudit } from "../../db/audit";
import { publicProcedure, router } from "../trpc";

export const auditRouter = router({
	run: publicProcedure.mutation(async (): Promise<AuditResult> => {
		return runAudit();
	}),
});
