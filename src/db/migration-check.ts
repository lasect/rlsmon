import { getSnapshot } from "../snapshots/storage";
import { catalogSql } from "./connection";

export interface ParsedMigration {
	tables: Array<{ schema: string; table: string; operations: string[] }>;
	rawStatements: string[];
}

export interface SafetyFinding {
	severity: "critical" | "warning" | "info";
	table: string;
	schema: string;
	operation: string;
	message: string;
	detail: string;
	affectedPolicies: string[];
}

export interface TableCheckResult {
	schema: string;
	table: string;
	hasRls: boolean;
	policyCount: number;
	policies: string[];
	operations: string[];
}

export interface SafetyResult {
	findings: SafetyFinding[];
	tablesChecked: TableCheckResult[];
	summary: {
		critical: number;
		warning: number;
		info: number;
		tablesScanned: number;
		tablesWithRls: number;
	};
	checkedAgainst: "live" | "snapshot";
	snapshotLabel?: string;
}

function normalizeSchema(schema: string | undefined): string {
	return schema?.trim() || "public";
}

export function parseMigrationSQL(sql: string): ParsedMigration {
	const rawStatements = sql
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const tableOps = new Map<string, Set<string>>();

	const alterTableRegex =
		/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const dropTableRegex =
		/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const dropPolicyRegex =
		/DROP\s+POLICY\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?)\s+ON\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const alterPolicyRegex =
		/ALTER\s+POLICY\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?)\s+ON\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const createPolicyRegex =
		/CREATE\s+POLICY\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?)\s+ON\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const disableRlsRegex =
		/ALTER\s+TABLE\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
	const enableRlsRegex =
		/ALTER\s+TABLE\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
	const fromJoinRegex =
		/(?:FROM|JOIN)\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const updateRegex =
		/UPDATE\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
	const insertIntoRegex =
		/INSERT\s+INTO\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.?)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;

	let match: RegExpExecArray | null;

	while ((match = alterTableRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("ALTER TABLE");
		}
	}

	while ((match = dropTableRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("DROP TABLE");
		}
	}

	while ((match = dropPolicyRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[2]);
		const table = match[3];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("DROP POLICY");
		}
	}

	while ((match = alterPolicyRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[2]);
		const table = match[3];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("ALTER POLICY");
		}
	}

	while ((match = createPolicyRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[2]);
		const table = match[3];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("CREATE POLICY");
		}
	}

	while ((match = disableRlsRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("DISABLE ROW LEVEL SECURITY");
		}
	}

	while ((match = enableRlsRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("ENABLE ROW LEVEL SECURITY");
		}
	}

	while ((match = fromJoinRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table && table.toLowerCase() !== "only") {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("READ");
		}
	}

	while ((match = updateRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("UPDATE");
		}
	}

	while ((match = insertIntoRegex.exec(sql)) !== null) {
		const schema = normalizeSchema(match[1]);
		const table = match[2];
		if (table) {
			const key = `${schema}.${table}`;
			if (!tableOps.has(key)) tableOps.set(key, new Set<string>());
			tableOps.get(key)!.add("INSERT");
		}
	}

	const tables: ParsedMigration["tables"] = Array.from(tableOps.entries()).map(
		([key, ops]) => {
			const [schema, table] = key.split(".");
			return {
				schema: schema || "public",
				table: table || "",
				operations: Array.from(ops),
			};
		},
	);

	return { tables, rawStatements };
}

async function getLiveTableInfo(
	schema: string,
	table: string,
): Promise<{ hasRls: boolean; policies: string[] }> {
	const rlsResult = await catalogSql<{ rowsecurity: boolean }[]>`
		SELECT relrowsecurity as rowsecurity
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = ${schema} AND c.relname = ${table}
	`;

	const hasRls = rlsResult[0]?.rowsecurity ?? false;

	const policiesResult = await catalogSql<{ policyname: string }[]>`
		SELECT policyname
		FROM pg_policies
		WHERE schemaname = ${schema} AND tablename = ${table}
		ORDER BY policyname
	`;

	return {
		hasRls,
		policies: policiesResult.map((p) => p.policyname),
	};
}

function getSnapshotTableInfo(
	snapshot: {
		tables: Array<{
			schemaname: string;
			tablename: string;
			rowsecurity: boolean;
		}>;
		policies: Array<{
			schemaname: string;
			tablename: string;
			policyname: string;
		}>;
	},
	schema: string,
	table: string,
): { hasRls: boolean; policies: string[] } | null {
	const tableInfo = snapshot.tables.find(
		(t) => t.schemaname === schema && t.tablename === table,
	);

	if (!tableInfo) {
		return null;
	}

	const policies = snapshot.policies
		.filter((p) => p.schemaname === schema && p.tablename === table)
		.map((p) => p.policyname);

	return {
		hasRls: tableInfo.rowsecurity,
		policies,
	};
}

export async function checkMigrationSafety(
	sql: string,
	snapshotId?: string,
): Promise<SafetyResult> {
	const parsed = parseMigrationSQL(sql);

	let snapshotLabel: string | undefined;
	let snapshotData: ReturnType<typeof getSnapshot> | null = null;

	if (snapshotId) {
		snapshotData = getSnapshot(snapshotId);
		if (snapshotData) {
			snapshotLabel = snapshotData.label;
		}
	}

	const tablesChecked: TableCheckResult[] = [];
	const findings: SafetyFinding[] = [];

	for (const { schema, table, operations } of parsed.tables) {
		const key = `${schema}.${table}`;
		let tableInfo: { hasRls: boolean; policies: string[] } | null;

		if (snapshotData) {
			const info = getSnapshotTableInfo(snapshotData, schema, table);
			tableInfo = info;
		} else {
			tableInfo = await getLiveTableInfo(schema, table);
		}

		const hasRls = tableInfo?.hasRls ?? false;
		const policies = tableInfo?.policies ?? [];

		tablesChecked.push({
			schema,
			table,
			hasRls,
			policyCount: policies.length,
			policies,
			operations,
		});

		for (const operation of operations) {
			switch (operation) {
				case "DISABLE ROW LEVEL SECURITY": {
					if (hasRls) {
						findings.push({
							severity: "critical",
							table,
							schema,
							operation,
							message: `DISABLE ROW LEVEL SECURITY removes protection from ${key}`,
							detail:
								"This will expose all rows to public access. All existing RLS policies are bypassed.",
							affectedPolicies: [...policies],
						});
					}
					break;
				}

				case "DROP POLICY": {
					if (hasRls && policies.length > 0) {
						findings.push({
							severity: "critical",
							table,
							schema,
							operation,
							message: `DROP POLICY removes access control from ${key}`,
							detail:
								"Users may gain unauthorized access to rows that were previously protected.",
							affectedPolicies: [...policies],
						});
					}
					break;
				}

				case "DROP TABLE": {
					if (hasRls || policies.length > 0) {
						findings.push({
							severity: "critical",
							table,
							schema,
							operation,
							message: `DROP TABLE removes table ${key} along with its RLS policies`,
							detail:
								"This permanently deletes the table and all associated RLS policies.",
							affectedPolicies: [...policies],
						});
					}
					break;
				}

				case "ALTER TABLE": {
					if (hasRls) {
						findings.push({
							severity: "warning",
							table,
							schema,
							operation,
							message: `ALTER TABLE modifies ${key} which has RLS enabled`,
							detail:
								"Schema changes on RLS-protected tables may affect policy behavior. Review your policies after migration.",
							affectedPolicies: [...policies],
						});
					}
					break;
				}

				case "ALTER POLICY": {
					if (hasRls && policies.length > 0) {
						findings.push({
							severity: "warning",
							table,
							schema,
							operation,
							message: `ALTER POLICY modifies policies on ${key}`,
							detail:
								"Policy changes may grant or revoke access. Review the changes carefully.",
							affectedPolicies: [...policies],
						});
					}
					break;
				}

				case "CREATE POLICY": {
					findings.push({
						severity: "info",
						table,
						schema,
						operation,
						message: `CREATE POLICY adds new access control to ${key}`,
						detail:
							"New policies help secure the table. Ensure they follow least-privilege principles.",
						affectedPolicies: [],
					});
					break;
				}

				case "ENABLE ROW LEVEL SECURITY": {
					findings.push({
						severity: "info",
						table,
						schema,
						operation,
						message: `ENABLE ROW LEVEL SECURITY adds RLS protection to ${key}`,
						detail:
							"RLS is now enabled. Ensure policies are properly configured.",
						affectedPolicies: [...policies],
					});
					break;
				}

				case "READ":
				case "UPDATE":
				case "INSERT": {
					if (hasRls) {
						findings.push({
							severity: "info",
							table,
							schema,
							operation,
							message: `${operation} operation on ${key} with RLS`,
							detail: `This ${operation} will be filtered by RLS policies. Verify expected rows are accessible.`,
							affectedPolicies: [...policies],
						});
					}
					break;
				}
			}
		}
	}

	const critical = findings.filter((f) => f.severity === "critical").length;
	const warning = findings.filter((f) => f.severity === "warning").length;
	const info = findings.filter((f) => f.severity === "info").length;
	const tablesWithRls = tablesChecked.filter((t) => t.hasRls).length;

	return {
		findings,
		tablesChecked,
		summary: {
			critical,
			warning,
			info,
			tablesScanned: tablesChecked.length,
			tablesWithRls,
		},
		checkedAgainst: snapshotId ? "snapshot" : "live",
		snapshotLabel,
	};
}
