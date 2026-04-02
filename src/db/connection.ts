import postgres from "postgres";
import { env } from "../env";

// Catalog connection pool - for reading schema metadata
// This is the primary read-only connection for pg_catalog queries
export const catalogSql = postgres(env.DATABASE_URL, {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});

// Simulation connection pool - isolated connections for role simulation
// Each simulation gets its own connection to avoid interfering with other sessions
export const simulationSql = postgres(env.DATABASE_URL, {
	max: 5,
	idle_timeout: 5,
	connect_timeout: 10,
});

// Test the connection and return version info
export async function testConnection(): Promise<{
	connected: boolean;
	version?: string;
	error?: string;
}> {
	try {
		const result = await catalogSql`SELECT version()`;
		const version = result[0]?.version as string;
		return { connected: true, version };
	} catch (error) {
		return {
			connected: false,
			error:
				error instanceof Error ? error.message : "Unknown connection error",
		};
	}
}

// Graceful shutdown
export async function closeConnections(): Promise<void> {
	await catalogSql.end();
	await simulationSql.end();
}
