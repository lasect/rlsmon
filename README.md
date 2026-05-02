# RLSMon

Developer tool for exploring, simulating, auditing, and understanding Row Level Security (RLS) in PostgreSQL.

## Usage

```bash
npx rlsmon <connection-string>
```

Opens a local HTTP server at `localhost:2711` (change with `--port`).

## Features

- **Policy Explorer** — Browse and understand RLS policies, annotate with notes
- **Role Explorer** — Inspect roles, inheritance, and permission heatmaps
- **Persona Simulation** — Test row visibility and access as different roles + JWT claims
- **Audit** — Lint your RLS setup for common issues, with CI-ready output
- **Migration Checks** — Validate migration DDL against existing RLS policies
- **AI Tools** — Plain-English explanations, policy suggestions, and audit summaries (multi-provider: Anthropic, OpenAI, Gemini, Mistral, Ollama)
- **Snapshots** — Save, annotate, and diff RLS configurations over time

## Privacy

- No database extensions required
- No data leaves your machine (except schema/Policies for AI features when enabled)
- Row data is never logged, stored, or transmitted

## License

GPL-3.0
