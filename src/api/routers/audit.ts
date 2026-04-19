import { type AuditResult, runAudit } from "../../db/audit";
import { getPolicyCoverageScore } from "../../db/catalog";
import { publicProcedure, router } from "../trpc";

export const auditRouter = router({
	run: publicProcedure.mutation(async (): Promise<AuditResult> => {
		return runAudit();
	}),
	coverage: publicProcedure.query(async () => {
		return getPolicyCoverageScore();
	}),
});
