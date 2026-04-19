import { catalogSql, simulationSql } from "./connection";

export interface SimulationOptions {
	role: string;
	jwtClaims?: Record<string, unknown>;
	seedRows?: Array<Record<string, unknown>>;
}

export interface SimulationResult {
	schema: string;
	table: string;
	columns: string[];
	rows: Record<string, unknown>[];
	error?: string;
	seedError?: string;
	seedRowCount?: number;
}

async function getTableColumns(
	schema: string,
	table: string,
): Promise<string[]> {
	const result = await catalogSql`
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = ${schema} AND table_name = ${table}
		ORDER BY ordinal_position
	`;
	return result.map((r) => r.column_name);
}

function buildInsertSql(
	schema: string,
	table: string,
	seedRows: Array<Record<string, unknown>>,
): { sql: string; params: unknown[] } {
	if (seedRows.length === 0) {
		return { sql: "", params: [] };
	}

	const columns = Object.keys(seedRows[0] as object);
	const params: unknown[] = [];

	const placeholders: string[] = [];
	for (let rowIdx = 0; rowIdx < seedRows.length; rowIdx++) {
		const rowPlaceholders: string[] = [];
		for (let colIdx = 0; colIdx < columns.length; colIdx++) {
			const paramNum = rowIdx * columns.length + colIdx + 1;
			rowPlaceholders.push(`$${paramNum}`);
			params.push(
				(seedRows[rowIdx] as Record<string, unknown>)[columns[colIdx]],
			);
		}
		placeholders.push(`(${rowPlaceholders.join(", ")})`);
	}

	const sql = `INSERT INTO "${schema}"."${table}" (${columns.join(", ")}) VALUES ${placeholders.join(", ")}`;

	return { sql, params };
}

export async function simulateSelect(
	schema: string,
	table: string,
	options: SimulationOptions,
): Promise<SimulationResult> {
	const sql = simulationSql;

	try {
		let rows: Record<string, unknown>[] = [];
		let columns: string[] = [];
		let seedRowCount = 0;

		await sql.begin(async (tx) => {
			await tx.unsafe(`SET ROLE "${options.role}"`);

			if (options.jwtClaims && Object.keys(options.jwtClaims).length > 0) {
				const claimsJson = JSON.stringify(options.jwtClaims);
				await tx`SET LOCAL request.jwt.claims = ${claimsJson}`;
			}

			if (options.seedRows && options.seedRows.length > 0) {
				const validColumns = await getTableColumns(schema, table);
				const seedRowColumns = Object.keys(options.seedRows[0]);

				for (const col of seedRowColumns) {
					if (!validColumns.includes(col)) {
						throw new Error(
							`Seed row contains unknown column '${col}'. Valid columns: ${validColumns.join(", ")}`,
						);
					}
				}

				const { sql: insertSql, params } = buildInsertSql(
					schema,
					table,
					options.seedRows,
				);
				await tx.unsafe(insertSql, params);
				seedRowCount = options.seedRows.length;
			}

			const result = await tx.unsafe(
				`SELECT * FROM "${schema}"."${table}" LIMIT 100`,
			);
			rows = result as Record<string, unknown>[];

			if (rows.length > 0 && rows[0] !== undefined) {
				columns = Object.keys(rows[0]);
			}
		});

		return {
			schema,
			table,
			columns,
			rows,
			seedRowCount: seedRowCount > 0 ? seedRowCount : undefined,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Simulation failed";
		const isSeedError =
			errorMessage.includes("unknown column") ||
			errorMessage.includes("Seed row");

		return {
			schema,
			table,
			columns: [],
			rows: [],
			error: errorMessage,
			seedError: isSeedError ? errorMessage : undefined,
		};
	}
}

// Validate that a role exists
export async function validateRole(role: string): Promise<boolean> {
	try {
		const result = await simulationSql`
			SELECT 1 FROM pg_roles WHERE rolname = ${role}
		`;
		return result.length > 0;
	} catch {
		return false;
	}
}
