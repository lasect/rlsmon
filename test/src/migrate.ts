import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgres://rlsmon:test@localhost:5433/rlsmon_test";

async function migrate() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log("🔌 Connecting to database...");
		await sql`SELECT 1`;
		console.log(" Connected");

		// Read schema file
		const schemaPath = join(import.meta.dir, "..", "sql", "schema.sql");
		console.log(` Loading schema from ${schemaPath}...`);

		let schema: string;
		try {
			schema = readFileSync(schemaPath, "utf-8");
		} catch (error) {
			console.error(`❌ Failed to read schema file: ${schemaPath}`);
			console.error(
				"Make sure the schema.sql file exists in the test/sql directory",
			);
			process.exit(1);
		}

		// Execute schema
		console.log("  Creating tables and RLS policies...");
		await sql.unsafe(schema);

		console.log(" Migration complete!");
		console.log("\n Created tables:");

		const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

		for (const table of tables) {
			console.log(`  • ${table.table_name}`);
		}

		console.log("\n RLS enabled tables:");
		const rlsTables = await sql`
      SELECT relname as table_name
      FROM pg_class
      WHERE relrowsecurity = true
      AND relnamespace = 'public'::regnamespace
      ORDER BY relname
    `;

		for (const table of rlsTables) {
			const policyCount = await sql`
        SELECT COUNT(*) as count
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = ${table.table_name}
      `;
			const countRow = policyCount[0];
			const count = countRow ? (countRow as { count: number }).count : 0;
			console.log(`  • ${table.table_name} (${count} policies)`);
		}
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

migrate();
