import { catalogSql, simulationSql } from "./connection";

export interface RoleAttributes {
	canLogin: boolean;
	superuser: boolean;
	bypassRls: boolean;
}

export interface TableRowsResult {
	rows: Record<string, unknown>[];
	columns: string[];
	primaryKeys: string[];
}

export interface RoleAccessResult {
	role: string;
	attributes: RoleAttributes;
}

export interface CannotAccessResult {
	role: string;
	attributes: RoleAttributes;
	reason: "rls_filtered" | "no_privilege";
}

export interface CheckRowAccessResult {
	canAccess: RoleAccessResult[];
	cannotAccess: CannotAccessResult[];
	checkedAt: string;
	rowSnapshot: Record<string, unknown>;
	error?: string;
}

interface RoleInfo {
	name: string;
	canLogin: boolean;
	superuser: boolean;
	bypassRls: boolean;
}

async function getLoginRoles(): Promise<RoleInfo[]> {
	const result = await catalogSql`
		SELECT 
			rolname as name,
			rolcanlogin as can_login,
			rolsuper as is_superuser,
			rolbypassrls as bypass_rls
		FROM pg_roles
		WHERE rolcanlogin = true AND rolname !~ '^pg_'
		ORDER BY rolname
	`;
	return result.map((r) => ({
		name: r.name,
		canLogin: r.can_login,
		superuser: r.is_superuser,
		bypassRls: r.bypass_rls,
	}));
}

async function getPrimaryKeys(
	schema: string,
	table: string,
): Promise<string[]> {
	try {
		const qualifiedName = `${schema}.${table}`;
		const result = await catalogSql`
			SELECT a.attname
			FROM pg_index i
			JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
			WHERE i.indrelid = ${qualifiedName}::regclass AND i.indisprimary
		`;
		return result.map((r) => r.attname).filter((k): k is string => k !== null);
	} catch {
		return [];
	}
}

export async function getTableRows(
	schema: string,
	table: string,
	limit = 50,
): Promise<TableRowsResult> {
	try {
		const primaryKeys = await getPrimaryKeys(schema, table);

		const qualifiedTable = `"${schema}"."${table}"`;
		const result = await catalogSql.unsafe(
			`SELECT * FROM ${qualifiedTable} LIMIT ${limit}`,
		);

		let columns: string[] = [];
		const rows = result as Record<string, unknown>[];
		if (rows.length > 0 && rows[0] !== undefined) {
			columns = Object.keys(rows[0]);
		}

		const fallbackKeys: string[] =
			primaryKeys.length === 0 && columns.length > 0
				? [columns[0] as string]
				: (primaryKeys as string[]);

		return {
			rows,
			columns,
			primaryKeys: fallbackKeys,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to fetch table rows";
		throw new Error(`Failed to get rows from ${schema}.${table}: ${message}`);
	}
}

export async function checkRowAccess(
	schema: string,
	table: string,
	pkValues: Record<string, unknown>,
	jwtClaims: Record<string, unknown> = {},
): Promise<CheckRowAccessResult> {
	try {
		const roles = await getLoginRoles();

		const pkColumns = Object.keys(pkValues);
		if (pkColumns.length === 0) {
			return {
				canAccess: [],
				cannotAccess: [],
				checkedAt: new Date().toISOString(),
				rowSnapshot: {},
				error: "No primary key values provided",
			};
		}

		const qualifiedTable = `"${schema}"."${table}"`;
		const whereClause = pkColumns.map((col) => `"${col}" = $1`).join(" AND ");
		const whereClauseOriginal = pkColumns
			.map((col, i) => `"${col}" = $${i + 1}`)
			.join(" AND ");

		const pkParams: (string | number | boolean | null | unknown)[] =
			pkColumns.map((col) => pkValues[col]);

		let rowSnapshot: Record<string, unknown> = {};
		try {
			const rowSnapshotResult = await catalogSql.unsafe(
				`SELECT * FROM ${qualifiedTable} WHERE ${whereClauseOriginal} LIMIT 1`,
				pkParams as Parameters<typeof catalogSql.unsafe>[1],
			);
			if (rowSnapshotResult.length > 0) {
				rowSnapshot = rowSnapshotResult[0] as Record<string, unknown>;
			}
		} catch {
			rowSnapshot = {};
		}

		const roleCheckPromises = roles.map(async (role) => {
			try {
				let hasAccess = false;
				await simulationSql.begin(async (tx) => {
					await tx.unsafe(`SET ROLE "${role.name}"`);

					if (Object.keys(jwtClaims).length > 0) {
						const claimsJson = JSON.stringify(jwtClaims);
						await tx.unsafe(`SET LOCAL request.jwt.claims = '${claimsJson}'`);
					}

					const query = `SELECT 1 FROM ${qualifiedTable} WHERE ${whereClause}`;
					const result = await tx.unsafe(
						query,
						pkParams as Parameters<typeof tx.unsafe>[1],
					);
					hasAccess = result.length > 0;
				});

				return {
					canAccess: hasAccess,
					role: role.name,
					reason: null as "rls_filtered" | "no_privilege" | null,
					attributes: {
						canLogin: role.canLogin,
						superuser: role.superuser,
						bypassRls: role.bypassRls,
					},
				};
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				const isNoPrivilege =
					errMsg.includes("permission denied") ||
					errMsg.includes("relation") ||
					errMsg.includes("does not exist") ||
					errMsg.includes("不存在") ||
					errMsg.includes("no such table");

				return {
					canAccess: false,
					role: role.name,
					reason: isNoPrivilege ? "no_privilege" : "rls_filtered",
					attributes: {
						canLogin: role.canLogin,
						superuser: role.superuser,
						bypassRls: role.bypassRls,
					},
				};
			}
		});

		const results = await Promise.all(roleCheckPromises);

		const canAccess: RoleAccessResult[] = [];
		const cannotAccess: CannotAccessResult[] = [];

		for (const result of results) {
			if (result.canAccess) {
				canAccess.push({
					role: result.role,
					attributes: result.attributes,
				});
			} else {
				cannotAccess.push({
					role: result.role,
					attributes: result.attributes,
					reason: (result.reason || "rls_filtered") as
						| "rls_filtered"
						| "no_privilege",
				});
			}
		}

		return {
			canAccess,
			cannotAccess,
			checkedAt: new Date().toISOString(),
			rowSnapshot,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to check row access";
		return {
			canAccess: [],
			cannotAccess: [],
			checkedAt: new Date().toISOString(),
			rowSnapshot: {},
			error: message,
		};
	}
}
