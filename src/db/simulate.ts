import { simulationSql } from "./connection";

export interface SimulationOptions {
	role: string;
	jwtClaims?: Record<string, unknown>;
}

export interface SimulationResult {
	schema: string;
	table: string;
	columns: string[];
	rows: Record<string, unknown>[];
	error?: string;
}

// Simulate a query as a specific role with JWT claims
// This ALWAYS runs in a transaction that is rolled back
export async function simulateSelect(
	schema: string,
	table: string,
	options: SimulationOptions,
): Promise<SimulationResult> {
	const sql = simulationSql;

	try {
		// Execute the query in a transaction that will rollback
		let rows: Record<string, unknown>[] = [];
		let columns: string[] = [];

		await sql.begin(async (tx) => {
			// Set the role
			await tx.unsafe(`SET ROLE "${options.role}"`);

			// Set JWT claims if provided
			if (options.jwtClaims && Object.keys(options.jwtClaims).length > 0) {
				const claimsJson = JSON.stringify(options.jwtClaims);
				await tx`SET LOCAL request.jwt.claims = ${claimsJson}`;
			}

			// Execute the query using unsafe for dynamic identifiers
			const result = await tx.unsafe(
				`SELECT * FROM "${schema}"."${table}" LIMIT 100`,
			);
			rows = result as Record<string, unknown>[];

			// Get column names from first row
			if (rows.length > 0 && rows[0] !== undefined) {
				columns = Object.keys(rows[0]);
			}

			// Rollback happens automatically when the transaction function completes
		});

		return {
			schema,
			table,
			columns,
			rows,
		};
	} catch (error) {
		return {
			schema,
			table,
			columns: [],
			rows: [],
			error: error instanceof Error ? error.message : "Simulation failed",
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
