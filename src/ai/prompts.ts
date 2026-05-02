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
	intent: string;
	schema?: string;
	table?: string;
	tableColumns?: Array<{ name: string; type: string }>;
	existingPolicies?: string[];
}): string {
	let tableContext =
		"No specific table provided — infer from intent or use placeholder.";
	if (input.schema && input.table && input.tableColumns) {
		const cols = input.tableColumns
			.map((c) => `${c.name} (${c.type})`)
			.join(", ");
		const existing =
			input.existingPolicies && input.existingPolicies.length > 0
				? `\nExisting policies on this table: ${input.existingPolicies.join(", ")}`
				: "";
		tableContext = `Table: ${input.schema}.${input.table}\nColumns: ${cols}${existing}`;
	}

	return `You are a PostgreSQL Row Level Security expert. Generate a complete RLS policy based on the developer's description.

Developer's intent: ${input.intent}

${tableContext}

Respond with ONLY a JSON object, no markdown, no text outside JSON:
{
  "policyName": "descriptive_snake_case_name",
  "schema": "public",
  "table": "table_name",
  "command": "SELECT | INSERT | UPDATE | DELETE | ALL",
  "permissive": "PERMISSIVE | RESTRICTIVE",
  "roles": ["role_name"] or [],
  "using": "SQL expression or null",
  "withCheck": "SQL expression or null",
  "sql": "Complete CREATE POLICY statement ready to run",
  "explanation": "One sentence: what this policy does and why",
  "warnings": []
}

If the intent mentions a specific table, use it. If not, infer a reasonable table name from context or use 'your_table_name' as placeholder.

Common RLS patterns to know:
- User owns row: user_id = auth.uid() or user_id = current_setting('app.user_id')::uuid
- Tenant isolation: tenant_id = current_setting('app.tenant_id')::uuid
- JWT claims: (auth.jwt() ->> 'role') = 'admin'
- Public read: true
- Owner write: user_id = current_setting('app.user_id')::uuid

Important: Generate syntactically correct PostgreSQL. Do not hallucinate function names. Only use standard PostgreSQL functions and common RLS patterns. Only use column names from the list above if provided.`;
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
