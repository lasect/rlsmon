# RLSMon

Developer tool for exploring, simulating, auditing, and understanding Row Level Security (RLS) in PostgreSQL.

## Usage

```bash
npx rlsmon <connection-string>
```

Opens a local HTTP server at `localhost:2711` (change with `--port`).

## Features

- **Access Matrix** — See who can access what at a glance
- **Policy Explorer** — Browse and understand RLS policies
- **Persona Simulation** — Test row visibility as different roles
- **Audit** — Lint your RLS setup for common issues
- **AI Tools** — Get plain-English explanations and policy suggestions
- **Snapshots** — Save and compare RLS configurations over time

## Privacy

- No database extensions required
- No data leaves your machine (except schema/Policies for AI features when enabled)
- Row data is never logged, stored, or transmitted

## License

GPL-3.0
