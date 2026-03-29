import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { join } from "node:path";
import { createContext } from "./api/context";
import { appRouter } from "./api/routers/index";
import { env } from "./env";

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

app.use("/*", serveStatic({ root: staticRoot }));

// Fallback to index.html for SPA
app.get("*", serveStatic({ path: join(staticRoot, "index.html") }));
console.log('RLSMon is up and running on https://local.rls.mo');

export default {
  port: 2711,
  fetch: app.fetch,
};
