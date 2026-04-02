#!/bin/bash
set -e

# Get project root (parent of test directory)
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Check if database is running
if ! docker ps -q -f name=rlsmon_test_db | grep -q .; then
    echo "🐳 Database not running, starting it..."
    cd "$PROJECT_ROOT"
    just db-up
fi

echo "🚀 Starting RLSMon with test database..."
cd "$PROJECT_ROOT"
export DATABASE_URL="postgres://rlsmon:test@localhost:5433/rlsmon_test"
exec bun run src/index.ts "$@"
