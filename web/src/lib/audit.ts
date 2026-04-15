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

export type AuditFormat = "pretty" | "json" | "github";
export type FailOnSeverity = AuditSeverity | "never";
export type ExitCodeBehavior = "fail-on-findings" | "always-succeed";

export const AUDIT_STORAGE_KEY = "rlsmon:audit:lastResults";

export const AUDIT_CHECKS = [
	"missing_rls",
	"bad_role_reference",
	"bypass_narrative",
	"policy_conflict",
	"dead_policy",
] as const;

export const AUDIT_SEVERITY_ORDER: AuditSeverity[] = [
	"critical",
	"warning",
	"info",
];

export const AUDIT_PLACEHOLDER_RESULTS: AuditResult = {
	findings: [
		{
			id: "missing_rls:public.accounts",
			check: "missing_rls",
			severity: "critical",
			schema: "public",
			table: "accounts",
			message: "Table has no RLS policies — all rows are exposed",
			detail: "Any role with SELECT privilege can read all rows in this table.",
			affectedPolicies: [],
		},
		{
			id: "policy_conflict:public.projects:select",
			check: "policy_conflict",
			severity: "warning",
			schema: "public",
			table: "projects",
			message: "Table has both permissive and restrictive policies for select",
			detail:
				"PostgreSQL ORs permissive policies then ANDs restrictive ones. This combination is rarely intentional and can produce unexpected access behavior.",
			affectedPolicies: ["projects_read", "projects_owner_only"],
		},
		{
			id: "dead_policy:public.invoices:allow_all:true",
			check: "dead_policy",
			severity: "info",
			schema: "public",
			table: "invoices",
			message: "Policy USING clause always allows all rows",
			detail:
				"This policy uses a literal true condition, so it does not filter rows at all. That may be intentional, but it often means the policy is broader than expected.",
			affectedPolicies: ["allow_all"],
		},
	],
	summary: {
		critical: 1,
		warning: 1,
		info: 1,
		tablesScanned: 12,
		ranAt: new Date().toISOString(),
	},
};

export function loadStoredAuditResults(): AuditResult | null {
	try {
		const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
		if (!saved) {
			return null;
		}

		const parsed = JSON.parse(saved) as Partial<AuditResult> & {
			ranAt?: string;
		};

		if (!Array.isArray(parsed.findings) || !parsed.summary?.ranAt) {
			return null;
		}

		return {
			findings: parsed.findings as AuditFinding[],
			summary: parsed.summary as AuditSummary,
		};
	} catch {
		return null;
	}
}

export function saveStoredAuditResults(result: AuditResult): void {
	try {
		localStorage.setItem(
			AUDIT_STORAGE_KEY,
			JSON.stringify({
				findings: result.findings,
				summary: result.summary,
				ranAt: result.summary.ranAt,
			}),
		);
	} catch {
		// localStorage unavailable
	}
}

export function formatRelativeTime(
	timestamp: string,
	now = Date.now(),
): string {
	const diffMs = now - new Date(timestamp).getTime();
	if (Number.isNaN(diffMs)) {
		return "unknown";
	}

	const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
	if (diffMinutes < 1) {
		return "just now";
	}
	if (diffMinutes === 1) {
		return "1 minute ago";
	}
	if (diffMinutes < 60) {
		return `${diffMinutes} minutes ago`;
	}

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours === 1) {
		return "1 hour ago";
	}
	if (diffHours < 24) {
		return `${diffHours} hours ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays === 1) {
		return "1 day ago";
	}
	return `${diffDays} days ago`;
}

export function buildAuditCommand(config: {
	failOn: FailOnSeverity;
	format: AuditFormat;
	checks: string[];
	exitCodeBehavior: ExitCodeBehavior;
}): string {
	const flags = [
		`--fail-on=${config.failOn}`,
		`--format=${config.format}`,
		`--checks=${config.checks.join(",")}`,
	];

	if (config.exitCodeBehavior === "always-succeed") {
		flags.push("--always-succeed");
	}

	return `npx rlsmon audit postgresql://... \\\n  ${flags.join(" \\\n  ")}`;
}

export function buildGithubActionsSnippet(failOn: FailOnSeverity): string {
	return `- name: RLS Audit
  run: npx rlsmon audit \${{ secrets.DATABASE_URL }} --fail-on=${failOn}`;
}

export function formatGithubAnnotation(finding: AuditFinding): string {
	const level =
		finding.severity === "critical"
			? "error"
			: finding.severity === "warning"
				? "warning"
				: "notice";

	return `::${level} file=${finding.schema}/${finding.table}::${finding.message}`;
}

export async function copyText(value: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(value);
	} catch {
		const textArea = document.createElement("textarea");
		textArea.value = value;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand("copy");
		document.body.removeChild(textArea);
	}
}
