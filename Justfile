# RLSMon Test Database - Justfile
# All commands for managing the test database

# Default recipe - show help
[private]
default:
    @just --list

# =============================================================================
# Database Lifecycle
# =============================================================================

# Start the test database
db-up:
    @echo "Starting PostgreSQL container..."
    docker compose -f test/docker/docker-compose.yml up -d
    @sleep 3
    @just db-wait

# Stop the test database
db-down:
    @echo "Stopping PostgreSQL container..."
    docker compose -f test/docker/docker-compose.yml down

# Stop and remove all data (DANGER)
db-clean:
    @echo "Stopping and removing all data..."
    docker compose -f test/docker/docker-compose.yml down -v --rmi all

# Wait for database to be ready
db-wait:
    @echo "Waiting for database to be ready..."
    @cd test && bun run src/test-connection.ts

# Show database logs
db-logs:
    docker compose -f test/docker/docker-compose.yml logs -f

# Check database status
db-status:
    docker compose -f test/docker/docker-compose.yml ps

# Open psql shell
db-shell:
    docker exec -it rlsmon_test_db psql -U rlsmon -d rlsmon_test

# =============================================================================
# Schema & Migrations
# =============================================================================

# Run migrations (create tables, RLS policies)
db-migrate:
    @echo "Running migrations..."
    @cd test && bun run src/migrate.ts

# Reset database (down, up, migrate, seed)
db-reset:
    @just db-clean
    @just db-up
    @sleep 2
    @just db-migrate
    @just db-seed

# =============================================================================
# Seeding
# =============================================================================

# Seed with minimal data (2 tenants, ~10 users)
db-seed-minimal:
    @echo "Seeding with minimal data..."
    @cd test && bun run src/seed.ts --minimal

# Seed with full data (5 tenants, ~100 users) - DEFAULT
db-seed:
    @echo "Seeding with full data..."
    @cd test && bun run src/seed.ts --full

# Seed with enterprise data (10 tenants, ~500 users)
db-seed-enterprise:
    @echo "Seeding with enterprise data..."
    @cd test && bun run src/seed.ts --enterprise

# =============================================================================
# Development Workflow
# =============================================================================

# Full setup - start DB, migrate, seed
dev-setup:
    @just db-up
    @sleep 2
    @just db-migrate
    @just db-seed

# Quick reset - keep DB, just remigrate and reseed
dev-refresh:
    @echo "Refreshing database..."
    @cd test && bun run src/migrate.ts
    @cd test && bun run src/seed.ts --full

# Start fresh development environment
dev-fresh:
    @just db-reset

# Run rlsmon with test database (starts DB if needed)
run *ARGS:
    @bash test/scripts/run-with-db.sh {{ARGS}}

# =============================================================================
# Testing & Debugging
# =============================================================================

# Test database connection
test-connection:
    @cd test && bun run src/test-connection.ts

# Run RLS test queries
test-rls:
    @echo "Running RLS test queries..."
    @docker exec rlsmon_test_db psql -U rlsmon -d rlsmon_test -c "SELECT relname as table_name, relrowsecurity as rls_enabled FROM pg_class WHERE relrowsecurity = true AND relnamespace = 'public'::regnamespace ORDER BY relname;"
    @echo ""
    @docker exec rlsmon_test_db psql -U rlsmon -d rlsmon_test -c "SELECT tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname LIMIT 20;"

# Show table row counts
test-counts:
    @echo "Row counts:"
    @docker exec rlsmon_test_db psql -U rlsmon -d rlsmon_test -c "SELECT 'tenants' as table_name, COUNT(*) as count FROM tenants UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'tenant_memberships', COUNT(*) FROM tenant_memberships UNION ALL SELECT 'projects', COUNT(*) FROM projects UNION ALL SELECT 'project_members', COUNT(*) FROM project_members UNION ALL SELECT 'tasks', COUNT(*) FROM tasks UNION ALL SELECT 'documents', COUNT(*) FROM documents UNION ALL SELECT 'comments', COUNT(*) FROM comments ORDER BY table_name;"

# Simulate RLS as a specific user
test-simulate USER_ID TENANT_ID:
    @echo "Simulating RLS for user {{USER_ID}} in tenant {{TENANT_ID}}..."
    @docker exec -it rlsmon_test_db psql -U rlsmon -d rlsmon_test -c "SET LOCAL request.jwt.claims.user_id = '{{USER_ID}}'; SET LOCAL request.jwt.claims.tenant_id = '{{TENANT_ID}}'; SELECT id, name, visibility, owner_id FROM projects LIMIT 10;"

# =============================================================================
# Utilities
# =============================================================================

# Install test dependencies
deps-install:
    @cd test && bun install

# Update test dependencies
deps-update:
    @cd test && bun update

# Format test code
fmt:
    @cd test && bun run check || true

# Show database configuration
config:
    @echo "Database Configuration:"
    @echo "Host: localhost:6923"
    @echo "Database: rlsmon_test"
    @echo "Username: rlsmon"
    @echo "Password: test"
    @echo ""
    @echo "Connection string:"
    @echo "postgres://rlsmon:test@localhost:6923/rlsmon_test"

# Export schema to file
export-schema:
    @echo "Exporting schema..."
    @docker exec rlsmon_test_db pg_dump -U rlsmon -d rlsmon_test --schema-only > test/sql/export_$(date +%Y%m%d_%H%M%S).sql
    @echo "Schema exported to test/sql/"

# Quick reference
help:
    @echo "RLSMon Test Database Commands"
    @echo "=============================="
    @echo ""
    @echo "Running RLSMon:"
    @echo "just run             - Start rlsmon with test DB (auto-starts DB)"
    @echo "just run --port 3000 - Start on custom port"
    @echo ""
    @echo "Database Lifecycle:"
    @echo "just db-up           - Start PostgreSQL container"
    @echo "just db-down         - Stop PostgreSQL container"
    @echo "just db-clean        - Stop and remove all data"
    @echo "just db-shell        - Open psql shell"
    @echo ""
    @echo "Setup & Seeding:"
    @echo "just dev-setup       - Full setup (up + migrate + seed)"
    @echo "just dev-fresh       - Complete reset with seed"
    @echo "just db-seed         - Seed with full data"
    @echo "just db-seed-minimal - Seed with minimal data"
    @echo "just db-seed-enterprise - Seed with enterprise data"
    @echo ""
    @echo "Testing:"
    @echo "just test-connection - Test DB connection"
    @echo "just test-rls        - Show RLS policies"
    @echo "just test-counts     - Show row counts"
    @echo "just test-simulate <user_id> <tenant_id> - Simulate RLS"
    @echo ""
    @echo "Development:"
    @echo "just dev-refresh     - Remigrate and reseed"
    @echo "just db-migrate      - Run migrations only"
    @echo ""
    @echo "Connection String:"
    @echo "postgres://rlsmon:test@localhost:6923/rlsmon_test"
