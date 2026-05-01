export function explainPolicyPrompt(policy: {
	name: string;
	table: string;
	schema: string;
	cmd: string;
	permissive: string;
	roles: string[];
	using: string | null;
	withCheck: string | null;
	tableColumns: Array<{ name: string; type: string }>;
}): string {
	const clauses: string[] = [];
	if (policy.using) {
		clauses.push(`USING clause: ${policy.using}`);
	}
	if (policy.withCheck) {
		clauses.push(`WITH CHECK clause: ${policy.withCheck}`);
	}
	const clausesStr = clauses.length > 0 ? `\n${clauses.join("\n")}` : "";

	return `You are a PostgreSQL Row Level Security expert. Explain the following RLS policy in plain English for a developer who may not be familiar with RLS. Be concise and practical. Focus on what access this policy grants or restricts and why it matters.

Policy name: ${policy.name}
Table: ${policy.schema}.${policy.table}
Command: ${policy.cmd}
Type: ${policy.permissive}
Applies to roles: ${policy.roles.length > 0 ? policy.roles.join(", ") : "all roles"}${clausesStr}

Table columns available: ${policy.tableColumns.map((c) => `${c.name} (${c.type})`).join(", ")}

Provide:
1. What this policy does in one sentence
2. Who can access what (or who is blocked)
3. Any security implications worth noting
4. A concrete example of when this policy would allow or deny access

Important: Only reference the table and column names provided above. Do not hallucinate column or table names.`;
}

export function suggestPolicyPrompt(input: {
	table: string;
	schema: string;
	intent: string;
	tableColumns: Array<{ name: string; type: string }>;
	existingPolicies: string[];
}): string {
	return `You are a PostgreSQL Row Level Security expert. Generate an RLS policy based on the developer's intent.

Table: ${input.schema}.${input.table}
Available columns: ${input.tableColumns.map((c) => `${c.name} (${c.type})`).join(", ")}
Existing policies on this table: ${input.existingPolicies.length > 0 ? input.existingPolicies.join(", ") : "none"}

Developer's intent: ${input.intent}

Respond with ONLY a JSON object in this exact format, no markdown, no explanation outside the JSON:
{
  "policyName": "snake_case_name",
  "command": "SELECT | INSERT | UPDATE | DELETE | ALL",
  "permissive": "PERMISSIVE | RESTRICTIVE",
  "roles": ["role_name"] or [],
  "using": "SQL expression or null",
  "withCheck": "SQL expression or null",
  "sql": "Complete CREATE POLICY statement",
  "explanation": "One sentence explaining what this policy does"
}

Important: Only use column names from the list above. Do not hallucinate.`;
}

export function auditSummaryPrompt(
	findings: Array<{
		check: string;
		severity: string;
		table: string;
		message: string;
	}>,
): string {
	const findingsList = findings
		.map(
			(f) =>
				`${f.severity.toUpperCase()}: ${f.check} on ${f.table} — ${f.message}`,
		)
		.join("\n");

	return `You are a PostgreSQL security expert. Summarize the following RLS audit findings for a developer. Be direct and actionable.

Findings:
${findingsList}

Write a 2-3 sentence executive summary of the overall RLS security posture, then list the top 3 most important things to fix first. Be concise. No fluff.`;
}
