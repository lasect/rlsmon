import { catalogSql } from "./connection";

export type AuditSeverity = "critical" | "warning" | "info";

export interface AuditFinding {
	id: string;
	check: string;
	severity: AuditSeverity;
	schema: string;
	table: string;
	message: string;
	detail: string;
	affectedRoles?: string[];
	affectedPolicies?: string[];
}

export interface AuditSummary {
	critical: number;
	warning: number;
	info: number;
	tablesScanned: number;
	ranAt: string;
}

export interface AuditResult {
	findings: AuditFinding[];
	summary: AuditSummary;
}

const CHECKS = [
	"missing_rls",
	"bad_role_reference",
	"bypass_narrative",
	"policy_conflict",
	"dead_policy",
] as const;

function normalizeExpression(expression: string | null): string | null {
	if (!expression) {
		return null;
	}

	let normalized = expression
		.trim()
		.toLowerCase()
		.replace(/::[a-z_][a-z0-9_ ]*/g, "")
		.replace(/\s+/g, "");

	while (normalized.startsWith("(") && normalized.endsWith(")")) {
		normalized = normalized.slice(1, -1);
	}

	return normalized;
}

function severityRank(severity: AuditSeverity): number {
	switch (severity) {
		case "critical":
			return 0;
		case "warning":
			return 1;
		case "info":
			return 2;
	}
}

function buildCheckFailureFinding(
	check: (typeof CHECKS)[number],
	error: unknown,
): AuditFinding {
	const message = error instanceof Error ? error.message : "Unknown error";

	return {
		id: `check_failed:${check}`,
		check,
		severity: "warning",
		schema: "system",
		table: check,
		message: `Check failed: ${message}`,
		detail: `The ${check} audit check did not complete. Verify the catalog query and PostgreSQL metadata shape used by this check.`,
	};
}

async function getAuditTableCount(): Promise<number> {
	const result = await catalogSql`
		SELECT COUNT(*)::int AS count
		FROM pg_tables
		WHERE schemaname !~ '^pg_'
			AND schemaname <> 'information_schema'
	`;

	return result[0]?.count ?? 0;
}

export async function checkMissingRls(): Promise<AuditFinding[]> {
	const rows = await catalogSql`
		SELECT
			t.schemaname AS schema,
			t.tablename AS table
		FROM pg_tables t
		JOIN pg_namespace n
			ON n.nspname = t.schemaname
		JOIN pg_class c
			ON c.relnamespace = n.oid
			AND c.relname = t.tablename
		LEFT JOIN pg_policies p
			ON p.schemaname = t.schemaname
			AND p.tablename = t.tablename
		WHERE t.schemaname !~ '^pg_'
			AND t.schemaname <> 'information_schema'
		GROUP BY t.schemaname, t.tablename, c.relrowsecurity
		HAVING NOT c.relrowsecurity OR COUNT(p.policyname) = 0
		ORDER BY t.schemaname, t.tablename
	`;

	return rows.map((row) => ({
		id: `missing_rls:${row.schema}.${row.table}`,
		check: "missing_rls",
		severity: "critical" as const,
		schema: row.schema,
		table: row.table,
		message: "Table has no RLS policies — all rows are exposed",
		detail: "Any role with SELECT privilege can read all rows in this table.",
	}));
}

export async function checkBadRoleReference(): Promise<AuditFinding[]> {
	const rows = await catalogSql`
		SELECT
			p.schemaname AS schema,
			p.tablename AS table,
			p.policyname AS policy_name,
			role_ref.role_name::text AS role_name
		FROM pg_policies p
		CROSS JOIN LATERAL unnest(COALESCE(p.roles, ARRAY[]::name[])) AS role_ref(role_name)
		LEFT JOIN pg_roles r
			ON r.rolname = role_ref.role_name::text
		WHERE p.schemaname !~ '^pg_'
			AND p.schemaname <> 'information_schema'
			AND role_ref.role_name::text NOT IN ('public')
			AND role_ref.role_name::text NOT LIKE 'pg_%'
			AND r.rolname IS NULL
		ORDER BY p.schemaname, p.tablename, p.policyname
	`;

	return rows.map((row) => ({
		id: `bad_role_reference:${row.schema}.${row.table}:${row.policy_name}:${row.role_name}`,
		check: "bad_role_reference",
		severity: "critical" as const,
		schema: row.schema,
		table: row.table,
		message: `Policy references role '${row.role_name}' which does not exist`,
		detail:
			"This policy will never apply because the role it targets is missing. This is often caused by a role being dropped without updating policies.",
		affectedRoles: [row.role_name],
		affectedPolicies: [row.policy_name],
	}));
}

export async function checkBypassNarrative(): Promise<AuditFinding[]> {
	const [securityDefinerRows, bypassRoleRows] = await Promise.all([
		catalogSql`
			SELECT DISTINCT
				p.schemaname AS schema,
				p.tablename AS table,
				p.policyname AS policy_name,
				proc_ns.nspname AS function_schema,
				proc.proname AS function_name
			FROM pg_policies p
			JOIN pg_proc proc
				ON proc.prosecdef = true
			JOIN pg_namespace proc_ns
				ON proc_ns.oid = proc.pronamespace
			WHERE p.schemaname !~ '^pg_'
				AND p.schemaname <> 'information_schema'
				AND proc_ns.nspname !~ '^pg_'
				AND proc_ns.nspname <> 'information_schema'
				AND (
					COALESCE(p.qual, '') ILIKE '%' || proc.proname || '(%'
					OR COALESCE(p.with_check, '') ILIKE '%' || proc.proname || '(%'
					OR COALESCE(p.qual, '') ILIKE '%' || proc_ns.nspname || '.' || proc.proname || '(%'
					OR COALESCE(p.with_check, '') ILIKE '%' || proc_ns.nspname || '.' || proc.proname || '(%'
				)
			ORDER BY p.schemaname, p.tablename, p.policyname, proc.proname
		`,
		catalogSql`
			SELECT
				rolname AS role_name
			FROM pg_roles
			WHERE rolbypassrls = true
				AND rolcanlogin = true
				AND rolname !~ '^pg_'
			ORDER BY rolname
		`,
	]);

	const findings: AuditFinding[] = securityDefinerRows.map((row) => ({
		id: `bypass_narrative:${row.schema}.${row.table}:${row.policy_name}:${row.function_schema}.${row.function_name}`,
		check: "bypass_narrative",
		severity: "warning",
		schema: row.schema,
		table: row.table,
		message: `Policy uses SECURITY DEFINER function '${row.function_schema}.${row.function_name}' — may bypass RLS intent`,
		detail:
			"SECURITY DEFINER functions run with the privileges of their owner. When a policy depends on one, access checks can behave differently than the caller expects and may bypass the intent of your RLS design.",
		affectedPolicies: [row.policy_name],
	}));

	for (const row of bypassRoleRows) {
		findings.push({
			id: `bypass_narrative:role:${row.role_name}`,
			check: "bypass_narrative",
			severity: "warning",
			schema: "roles",
			table: row.role_name,
			message: `Role '${row.role_name}' can login and has BYPASSRLS — it bypasses all policies`,
			detail:
				"A login role with BYPASSRLS ignores every row-level security policy in the database. Treat it as an administrative escape hatch and review whether interactive use is intentional.",
			affectedRoles: [row.role_name],
		});
	}

	return findings;
}

export async function checkPolicyConflict(): Promise<AuditFinding[]> {
	const rows = await catalogSql`
		SELECT
			schemaname AS schema,
			tablename AS table,
			cmd,
			array_agg(policyname ORDER BY policyname) AS policy_names
		FROM pg_policies
		WHERE schemaname !~ '^pg_'
			AND schemaname <> 'information_schema'
		GROUP BY schemaname, tablename, cmd
		HAVING BOOL_OR(UPPER(permissive) = 'PERMISSIVE')
			AND BOOL_OR(UPPER(permissive) = 'RESTRICTIVE')
		ORDER BY schemaname, tablename, cmd
	`;

	return rows.map((row) => ({
		id: `policy_conflict:${row.schema}.${row.table}:${row.cmd}`,
		check: "policy_conflict",
		severity: "warning" as const,
		schema: row.schema,
		table: row.table,
		message: `Table has both permissive and restrictive policies for ${String(
			row.cmd,
		).toLowerCase()}`,
		detail:
			"PostgreSQL ORs permissive policies then ANDs restrictive ones. This combination is rarely intentional and can produce unexpected access behavior.",
		affectedPolicies: Array.isArray(row.policy_names) ? row.policy_names : [],
	}));
}

export async function checkDeadPolicy(): Promise<AuditFinding[]> {
	const rows = await catalogSql`
		SELECT
			p.schemaname AS schema,
			p.tablename AS table,
			p.policyname AS policy_name,
			p.qual AS using,
			c.relrowsecurity AS rls_enabled,
			c.reltuples
		FROM pg_policies p
		JOIN pg_namespace n
			ON n.nspname = p.schemaname
		JOIN pg_class c
			ON c.relnamespace = n.oid
			AND c.relname = p.tablename
		WHERE p.schemaname !~ '^pg_'
			AND p.schemaname <> 'information_schema'
		ORDER BY p.schemaname, p.tablename, p.policyname
	`;

	const findings: AuditFinding[] = [];

	for (const row of rows) {
		const normalized = normalizeExpression(row.using);

		if (
			normalized === "false" ||
			normalized === "1=0" ||
			normalized === "1=2"
		) {
			findings.push({
				id: `dead_policy:${row.schema}.${row.table}:${row.policy_name}:false`,
				check: "dead_policy",
				severity: "info",
				schema: row.schema,
				table: row.table,
				message: "Policy USING clause appears to never filter rows",
				detail:
					"This policy uses a literal false condition, so it will never match any rows. That can be intentional for deny-by-default patterns, but it is often leftover debug logic or an incomplete policy.",
				affectedPolicies: [row.policy_name],
			});
		}

		if (normalized === "true") {
			findings.push({
				id: `dead_policy:${row.schema}.${row.table}:${row.policy_name}:true`,
				check: "dead_policy",
				severity: "info",
				schema: row.schema,
				table: row.table,
				message: "Policy USING clause always allows all rows",
				detail:
					"This policy uses a literal true condition, so it does not filter rows at all. That may be intentional, but it often means the policy is broader than expected.",
				affectedPolicies: [row.policy_name],
			});
		}

		if (row.rls_enabled && Number(row.reltuples) === 0) {
			findings.push({
				id: `dead_policy:${row.schema}.${row.table}:${row.policy_name}:empty`,
				check: "dead_policy",
				severity: "info",
				schema: row.schema,
				table: row.table,
				message:
					"Policy is defined on an empty table — row filtering cannot be validated yet",
				detail:
					"PostgreSQL estimates this table has zero rows, so the audit cannot infer how this policy behaves against real data. Review it again after the table contains representative rows.",
				affectedPolicies: [row.policy_name],
			});
		}
	}

	return findings;
}

export async function runAudit(): Promise<AuditResult> {
	const [tablesScanned, checkResults] = await Promise.all([
		getAuditTableCount(),
		Promise.all(
			CHECKS.map(async (check) => {
				try {
					switch (check) {
						case "missing_rls":
							return await checkMissingRls();
						case "bad_role_reference":
							return await checkBadRoleReference();
						case "bypass_narrative":
							return await checkBypassNarrative();
						case "policy_conflict":
							return await checkPolicyConflict();
						case "dead_policy":
							return await checkDeadPolicy();
					}
				} catch (error) {
					return [buildCheckFailureFinding(check, error)];
				}
			}),
		),
	]);

	const findings = checkResults.flat().sort((a, b) => {
		const severityDiff = severityRank(a.severity) - severityRank(b.severity);
		if (severityDiff !== 0) {
			return severityDiff;
		}

		const tableDiff = `${a.schema}.${a.table}`.localeCompare(
			`${b.schema}.${b.table}`,
		);
		if (tableDiff !== 0) {
			return tableDiff;
		}

		return a.id.localeCompare(b.id);
	});

	const ranAt = new Date().toISOString();

	return {
		findings,
		summary: {
			critical: findings.filter((finding) => finding.severity === "critical")
				.length,
			warning: findings.filter((finding) => finding.severity === "warning")
				.length,
			info: findings.filter((finding) => finding.severity === "info").length,
			tablesScanned,
			ranAt,
		},
	};
}
