import postgres from "postgres";

const DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgres://rlsmon:test@localhost:6923/rlsmon_test";

async function testConnection() {
	const sql = postgres(DATABASE_URL);

	try {
		console.log("🔌 Testing database connection...");
		console.log(`   URL: ${DATABASE_URL.replace(/:[^:]*@/, ":****@")}`);

		const startTime = Date.now();
		const result = await sql`SELECT version()`;
		const duration = Date.now() - startTime;

		console.log(" Connection successful!");
		console.log(`   Response time: ${duration}ms`);

		const versionRow = result[0];
		if (versionRow && "version" in versionRow) {
			const versionStr = String(versionRow.version);
			console.log(
				`   PostgreSQL: ${versionStr.split(" ")[0]} ${versionStr.split(" ")[1]}`,
			);
		}

		// Test RLS function
		console.log("\n Testing RLS helper functions...");
		const userIdResult = await sql`SELECT current_user_id()`;
		const tenantIdResult = await sql`SELECT current_tenant_id()`;
		const userIdRow = userIdResult[0];
		const tenantIdRow = tenantIdResult[0];
		console.log(
			`   current_user_id(): ${userIdRow && "current_user_id" in userIdRow ? userIdRow.current_user_id : "NULL (expected without JWT claims)"}`,
		);
		console.log(
			`   current_tenant_id(): ${tenantIdRow && "current_tenant_id" in tenantIdRow ? tenantIdRow.current_tenant_id : "NULL (expected without JWT claims)"}`,
		);

		// Test table count
		const tableCount = await sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
		const tableCountRow = tableCount[0];
		console.log(
			`\n Tables in database: ${tableCountRow && "count" in tableCountRow ? tableCountRow.count : 0}`,
		);

		// Test RLS policy count
		const policyCount = await sql`
      SELECT COUNT(*) as count FROM pg_policies WHERE schemaname = 'public'
    `;
		const policyCountRow = policyCount[0];
		console.log(
			` RLS policies: ${policyCountRow && "count" in policyCountRow ? policyCountRow.count : 0}`,
		);

		// Test sample data
		const userCount = await sql`SELECT COUNT(*) as count FROM users`;
		const tenantCount = await sql`SELECT COUNT(*) as count FROM tenants`;
		const projectCount = await sql`SELECT COUNT(*) as count FROM projects`;

		const userCountRow = userCount[0];
		const tenantCountRow = tenantCount[0];
		const projectCountRow = projectCount[0];

		console.log("\n Sample data:");
		console.log(
			`   Users: ${userCountRow && "count" in userCountRow ? userCountRow.count : 0}`,
		);
		console.log(
			`   Tenants: ${tenantCountRow && "count" in tenantCountRow ? tenantCountRow.count : 0}`,
		);
		console.log(
			`   Projects: ${projectCountRow && "count" in projectCountRow ? projectCountRow.count : 0}`,
		);

		if (userCountRow && "count" in userCountRow && userCountRow.count === "0") {
			console.log("\n  No data found. Run: just db:seed");
		}
	} catch (error) {
		console.error("\n❌ Connection failed!");
		if (error instanceof Error) {
			if (error.message.includes("ECONNREFUSED")) {
				console.error("   Database is not running. Start it with: just db:up");
			} else if (error.message.includes("password")) {
				console.error("   Authentication failed. Check your DATABASE_URL.");
			} else {
				console.error(`   Error: ${error.message}`);
			}
		}
		process.exit(1);
	} finally {
		await sql.end();
	}
}

testConnection();
