#!/usr/bin/env bun

const args = process.argv.slice(2);
let dbUrl = "";
let port = "2711";

for (let i = 0; i < args.length; i++) {
	if (args[i] === "--port" || args[i] === "-p") {
		port = args[++i] || "2711";
	} else if (!args[i].startsWith("-")) {
		dbUrl = args[i];
	}
}

if (dbUrl) {
	process.env.DATABASE_URL = dbUrl;
} else if (!process.env.DATABASE_URL) {
	console.error("Usage: npx rlsmon <connection-string> [--port <port>]");
	console.error("  connection-string  PostgreSQL connection string");
	console.error("  --port, -p         Port to listen on (default: 2711)");
	process.exit(1);
}

process.env.PORT = process.env.PORT || port;

await import("./index.ts");
