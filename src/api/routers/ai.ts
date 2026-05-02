import { z } from "zod";
import { getAIClient } from "../../ai/client";
import {
	auditSummaryPrompt,
	explainPolicyPrompt,
	suggestPolicyPrompt,
} from "../../ai/prompts";
import { catalogSql } from "../../db/connection";
import { publicProcedure, router } from "../trpc";

interface SuggestedPolicy {
	policyName: string;
	schema: string;
	table: string;
	command: string;
	permissive: string;
	roles: string[];
	using: string | null;
	withCheck: string | null;
	sql: string;
	explanation: string;
	warnings: string[];
}

export const aiRouter = router({
	explain: publicProcedure
		.input(
			z.object({
				policyName: z.string(),
				schema: z.string(),
				table: z.string(),
				cmd: z.string(),
				permissive: z.string(),
				roles: z.array(z.string()),
				using: z.string().nullable(),
				withCheck: z.string().nullable(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Fetch table columns from information_schema
				const columnRows = await catalogSql`
					SELECT column_name as name, data_type as type
					FROM information_schema.columns
					WHERE table_schema = ${input.schema} AND table_name = ${input.table}
					ORDER BY ordinal_position
				`;
				const tableColumns = columnRows.map((row: Record<string, unknown>) => ({
					name: row.name as string,
					type: row.type as string,
				}));

				// AI prompt contains schema only — no row data per AGENTS.md
				const prompt = explainPolicyPrompt({
					name: input.policyName,
					table: input.table,
					schema: input.schema,
					cmd: input.cmd,
					permissive: input.permissive,
					roles: input.roles,
					using: input.using,
					withCheck: input.withCheck,
					tableColumns,
				});

				const client = getAIClient();
				const explanation = await client.generate(prompt);

				return { explanation };
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";
				if (message === "No AI provider configured. Set one in Settings.") {
					return { error: "no_provider" };
				}
				return { error: "api_error", message };
			}
		}),

	suggest: publicProcedure
		.input(
			z.object({
				intent: z.string(),
				schema: z.string().optional(),
				table: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				let tableColumns: Array<{ name: string; type: string }> | undefined;
				let existingPolicies: string[] | undefined;

				if (input.schema && input.table) {
					const columnRows = await catalogSql`
						SELECT column_name as name, data_type as type
						FROM information_schema.columns
						WHERE table_schema = ${input.schema} AND table_name = ${input.table}
						ORDER BY ordinal_position
					`;
					tableColumns = columnRows.map((row: Record<string, unknown>) => ({
						name: row.name as string,
						type: row.type as string,
					}));

					const policyRows = await catalogSql`
						SELECT policyname as name
						FROM pg_policies
						WHERE schemaname = ${input.schema} AND tablename = ${input.table}
					`;
					existingPolicies = policyRows.map(
						(row: Record<string, unknown>) => row.name as string,
					);
				}

				// AI prompt contains schema only — no row data per AGENTS.md
				const prompt = suggestPolicyPrompt({
					intent: input.intent,
					schema: input.schema,
					table: input.table,
					tableColumns,
					existingPolicies,
				});

				const client = getAIClient();
				const rawResponse = await client.generate(prompt);

				let policy: SuggestedPolicy;
				try {
					// Strip markdown code fences if present
					let jsonStr = rawResponse.trim();
					if (jsonStr.startsWith("```")) {
						jsonStr = jsonStr
							.replace(/^```(?:json)?\s*\n?/, "")
							.replace(/\n?```\s*$/, "");
					}
					policy = JSON.parse(jsonStr) as SuggestedPolicy;
				} catch {
					return {
						error: "parse_error",
						message: "Failed to parse AI response as valid JSON policy.",
					};
				}

				return { policy };
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";
				if (message === "No AI provider configured. Set one in Settings.") {
					return { error: "no_provider" };
				}
				return { error: "api_error", message };
			}
		}),

	// Executes user-provided CREATE POLICY SQL — schema write operation
	// No row data involved
	applyPolicy: publicProcedure
		.input(
			z.object({
				sql: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const trimmed = input.sql.trim();
			if (!trimmed.toLowerCase().startsWith("create policy")) {
				throw new Error(
					"Only CREATE POLICY statements are allowed. Your SQL must start with CREATE POLICY.",
				);
			}
			const noTrailing = trimmed.replace(/;\s*$/, "");
			if (noTrailing.includes(";")) {
				throw new Error(
					"Multiple SQL statements are not allowed. Provide only a single CREATE POLICY statement.",
				);
			}

			try {
				await catalogSql.unsafe(trimmed);
				return { success: true, message: "Policy created" };
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";
				return { error: "exec_error", message };
			}
		}),

	summarize: publicProcedure
		.input(
			z.object({
				findings: z.array(
					z.object({
						check: z.string(),
						severity: z.string(),
						table: z.string(),
						message: z.string(),
					}),
				),
			}),
		)
		.mutation(async ({ input }) => {
			if (input.findings.length === 0) {
				return { summary: "No findings to summarize." };
			}

			try {
				// AI prompt contains schema only — no row data per AGENTS.md
				const prompt = auditSummaryPrompt(input.findings);

				const client = getAIClient();
				const summary = await client.generate(prompt);

				return { summary };
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";
				if (message === "No AI provider configured. Set one in Settings.") {
					return { error: "no_provider" };
				}
				return { error: "api_error", message };
			}
		}),
});
