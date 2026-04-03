import { join } from "node:path";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { createContext } from "./api/context";
import { appRouter } from "./api/routers/index";
import { closeConnections, testConnection } from "./db/connection";
import { env } from "./env";

// Test database connection before starting
const connectionResult = await testConnection();
if (!connectionResult.connected) {
	console.error("Failed to connect to PostgreSQL:");
	console.error(connectionResult.error);
	console.error("\nPlease check your DATABASE_URL environment variable.");
	process.exit(1);
}

console.log(
	`Connected to PostgreSQL: ${connectionResult.version?.split(" ")[0]}`,
);

const app = new Hono();

app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.get("/api/health", (c) => {
	return c.text("OK");
});

// Serve static files from the Vite build output
const staticRoot = import.meta.dir.endsWith("src")
	? join(import.meta.dir, "../dist/web")
	: join(import.meta.dir, "web");

// Pre-load index.html content for SPA fallback
const indexHtml = await Bun.file(join(staticRoot, "index.html")).text();

// Serve static assets (JS, CSS, images, etc.)
app.use("/assets/*", serveStatic({ root: staticRoot }));

// Serve index.html for all non-API routes (SPA fallback)
app.get("/*", (c, next) => {
	const reqPath = c.req.path;

	// Skip API and tRPC routes
	if (reqPath.startsWith("/api/") || reqPath.startsWith("/trpc/")) {
		return next();
	}

	// Serve index.html for all routes (React Router handles client-side routing)
	return c.html(indexHtml);
});

console.log("RLSMon is up and running on http://localhost:2711");

// Handle graceful shutdown
process.on("SIGINT", async () => {
	console.log("\nShutting down...");
	await closeConnections();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await closeConnections();
	process.exit(0);
});

export default {
	port: 2711,
	fetch: app.fetch,
};
