# AGENTS.md

## Project Overview

RLSMon is a developer tool for exploring, simulating, auditing, and understanding Row Level Security (RLS) in PostgreSQL. It runs via `npx rlsmon <connection-string>` and spins up a local HTTP server that serves an SPA, with the same server acting as the backend. No database extensions required. No data leaves the machine except for AI features, which send only schema and policy SQL (never row data) to the Anthropic API.

---

## Repo Structure
```
rlsmon/
├── src/              # bun http server, all /api/* routes, pg connection
│   ├── api/          # tRPC routers and context
│   ├── env.ts        # environment configuration
│   └── index.ts      # server entrypoint
├── web/              # react spa, vite, tailwind (separate bun project)
│   ├── src/          # frontend source
│   ├── public/       # static assets
│   └── package.json  # web dependencies
├── .rlsmon/          # local snapshots and annotations (gitignored by default)
├── dist/             # compiled server output
├── package.json      # root dependencies + server
├── tsconfig.json     # server tsconfig
└── biome.json        # linting/formatting config
```

---

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React + React Router + Tailwind CSS + Vite
- **Backend**: Bun's native HTTP server
- **Database**: PostgreSQL (via `pg` or `postgres` npm package)
- **Linting/Formatting**: Biome
- **Language**: TypeScript throughout

---

## Package Responsibilities

### Root package (server)
- Bun HTTP server on port 2711 (configurable via `--port`)
- Connects to Postgres on startup, exits with a clear error message if connection fails
- Serves `web/dist` as static files for all non-`/api` routes (SPA fallback)
- All API routes live under `/api/*`
- Never logs or stores row data, only schema and catalog data
- Maintains two pg connection pools: one for catalog reads, one for isolated simulation sessions

### `web/`
- React SPA built with Vite
- All routes defined in `src/App.tsx`
- Global state (connection meta, active persona) managed via React Context or Zustand
- API calls abstracted into `src/api/` — one file per domain (policies, roles, simulate, audit, ai, snapshots)
- Active persona (role + jwt claims) persisted in component state, shown in bottom status bar globally

---

## API Routes

The API uses tRPC (mounted at `/trpc/*`) with two direct Hono routes for health and snapshot rename. All routes return `{ error: string }` on failure.

### Direct routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Connection status, pg version |
| POST | `/api/snapshots/rename` | Rename a snapshot |

### tRPC routers

| Router | Procedure | Method | Description |
|--------|-----------|--------|-------------|
| `health` | `check` | GET | Connection status, pg version |
| `meta` | `get` | GET | Bootstrap payload: all tables, roles, policies |
| `matrix` | `get` | GET | Computed access matrix |
| `policies` | `list` | GET | All policies from pg_policies |
| `policies` | `getByTable` | GET | Policies for a specific table |
| `roles` | `list` | GET | All roles + inheritance |
| `roles` | `get` | GET | Single role detail |
| `simulate` | `select` | POST | Accepts role + jwt claims, returns filtered rows |
| `audit` | `run` | POST | Runs full linter ruleset, returns findings |
| `audit` | `coverage` | GET | RLS coverage stats per table |
| `ai` | `explain` | POST | Accepts policy SQL, returns plain-English explanation |
| `ai` | `suggest` | POST | Accepts natural language + table schema, returns policy SQL |
| `ai` | `summarize` | POST | Natural language summary of audit findings |
| `snapshots` | `list` | GET | List saved snapshots |
| `snapshots` | `get` | GET | Get a single snapshot |
| `snapshots` | `create` | POST | Save a new snapshot |
| `snapshots` | `delete` | POST | Delete a snapshot |
| `snapshots` | `rename` | POST | Rename a snapshot |
| `snapshots` | `diff` | GET | Diff two snapshots by id |
| `rowAccess` | `getRows` | GET | Get rows for a table |
| `rowAccess` | `checkAccess` | POST | Check row-level access for a role |
| `migrationCheck` | `check` | POST | Validate migration DDL against existing policies |
| `migrationCheck` | `parse` | POST | Parse migration DDL into statements |
| `annotations` | `list` | GET | List all annotations |
| `annotations` | `get` | GET | Get annotation for a key |
| `annotations` | `set` | POST | Set annotation for a key |
| `annotations` | `delete` | POST | Delete an annotation |
| `settings` | `get` | GET | Get current settings |
| `settings` | `setProviderKey` | POST | Set API key for a provider |
| `settings` | `setActiveProvider` | POST | Set active AI provider |

---

## Frontend Routes

| Route | Page |
|-------|------|
| `/` | Redirects to `/audit` |
| `/explore/policies` | Policy explorer |
| `/explore/roles` | Role explorer |
| `/simulate` | Persona simulation |
| `/audit` | Audit overview |
| `/audit/ci` | CI mode config + output preview |
| `/ai` | AI tools (explain, suggest, summary) |
| `/history` | Snapshots list |
| `/history/:snapshotId` | Single snapshot detail |
| `/settings` | Connection info, API key, pro license |

---

## Key Conventions

### Postgres Querying
- All catalog queries go through `src/db/catalog.ts`
- Simulation queries go through `src/db/simulate.ts` — always in a transaction, always rolled back, never committed
- Never interpolate user input directly into SQL — always use parameterized queries
- Simulation uses `SET ROLE` and `SET LOCAL request.jwt.claims` within a transaction on an isolated connection

### Data Privacy
- Row data is only ever used in simulation results returned to the local client
- Row data is never logged, never written to disk, never sent to external APIs
- AI endpoints receive only: table name, column names and types, policy name, USING clause, WITH CHECK clause

### Snapshots & Annotations
- Snapshots are saved as JSON files in `.rlsmon/snapshots/`
- Annotations are saved in `.rlsmon/annotations.json`
- Both are local by default and can be committed to git
- Snapshot filenames are `{timestamp}-{short-hash}.json`

### Error Handling
- All API routes wrap handlers in try/catch and return `{ error: string }` with appropriate status codes
- Connection failure on startup exits the process with code 1 and a human-readable message
- Simulation errors (e.g. role does not exist) return a structured error, not a 500

### Styling
- Tailwind utility classes only — no custom CSS files
- Dark mode first
- Keep the UI density high — this is a developer tool, not a marketing page
- Use a monospace font for all SQL, policy expressions, and json output

---

## AI Features

- Model: User configurable per provider in Settings. Defaults: Anthropic (`claude-sonnet-4-20250514`), OpenAI (`gpt-4o-mini`), Gemini (`gemini-2.0-flash`), Mistral (`mistral-small-latest`), Ollama (`llama3.2`), OpenAI-compatible (`gpt-4o-mini`).
- API creds are provided by the user in `/settings` and stored encrypted on disk after user's consent.
- All AI prompts are in `src/ai/prompts.ts`
- Prompts must include the instruction to never hallucinate table or column names — only use what is provided in the prompt context

---

## What Agents Should Know

- Do not modify `.rlsmon/` contents — treat them as user data
- Do not add any `console.log` statements that could print row data
- When adding a new API route, add it to `src/api/routers/` and document it in this file
- When adding a new page, add it to `web/src/App.tsx` and document it in this file
- The simulation connection pool must always roll back — never add a code path that commits a simulation transaction
- All user-facing text (labels, error messages, empty states) should be developer-friendly and direct — no marketing language inside the app
- TypeScript strict mode is on — no `any` unless absolutely necessary and commented with a reason
