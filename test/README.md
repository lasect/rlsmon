# RLSMon Test Database

A comprehensive Docker-based PostgreSQL test database with realistic Row Level Security (RLS) policies for testing RLSMon.

## Quick Start

```bash
# Install dependencies and start everything
cd test && bun install
cd ..
just dev:setup
```

This will:
1. Start PostgreSQL in Docker
2. Create all tables with RLS policies
3. Seed with realistic data (5 tenants, ~100 users, 50+ projects, 500+ tasks)

## Available Data Profiles

- **minimal** (~2 min): 2 tenants, 10 users, 6 projects, 50 tasks
- **full** (~5 min): 5 tenants, 100 users, 50 projects, 500 tasks  
- **enterprise** (~15 min): 10 tenants, 500 users, 300 projects, 5000 tasks

```bash
just db:seed:minimal    # Quick test
just db:seed            # Standard (default)
just db:seed:enterprise # Full stress test
```

## Connection

```
postgresql://rlsmon:test@localhost:6923/rlsmon_test
```

## RLS Scenarios Covered

The schema includes 15+ tables demonstrating every major RLS pattern:

### 1. Tenant Isolation
- `tenants` - Multi-tenant root table
- Users only see data from their tenant

### 2. Role-Based Access
- `users` - Global accounts
- `tenant_memberships` - Role assignment (owner/admin/manager/member/viewer/guest)
- `role_hierarchy` - Organizational reporting structure

### 3. Ownership-Based
- `projects` - Owner has full control
- `tasks` - Reporter/assignee permissions
- `documents` - Owner controls access

### 4. Team-Based Access
- `project_members` - Project team membership
- Members see related tasks and documents

### 5. Visibility Levels
- **private** - Only owner + admins
- **internal** - All tenant members
- **public** - Anyone (cross-tenant)
- **shared** - Specific users/tenants

### 6. Hierarchical Permissions
- Managers see subordinate data via `role_hierarchy`
- Level-based access control

### 7. Time-Based Access
- `documents.expires_at` - Expiring access
- Soft deletes via `deleted_at`

### 8. JWT Claim Integration
```sql
SET LOCAL request.jwt.claims.user_id = 'uuid-here';
SET LOCAL request.jwt.claims.tenant_id = 'uuid-here';
SELECT * FROM projects; -- RLS filtered results
```

### 9. Soft Deletes
All tables have `deleted_at` for audit trails without data loss

### 10. Audit Logging
- `audit_logs` - Immutable history of all changes
- Automatic trigger-based logging

### 11. Granular Permissions
- `document_permissions` - Per-user access levels
- Permission levels: none/view/comment/edit/admin

### 12. Approval Workflows
- `approval_workflows` - Multi-step approvals
- `approval_steps` - Individual approval actions

### 13. Resource Sharing
- `project_shares` - Cross-tenant project sharing
- Share types: tenant/user/link

### 14. API Keys & Service Accounts
- `api_keys` - Scoped API access
- Role-based key permissions

### 15. Custom Roles
- `custom_roles` - Tenant-defined roles
- `user_custom_roles` - User-to-custom-role assignments

## Key RLS Policies

### Tenant Isolation
```sql
CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    USING (
        id = current_tenant_id() OR
        EXISTS (
            SELECT 1 FROM tenant_memberships
            WHERE tenant_id = tenants.id
            AND user_id = current_user_id()
            AND deleted_at IS NULL
        )
    );
```

### Private Tasks
```sql
CREATE POLICY tasks_private ON tasks
    FOR SELECT
    USING (
        is_private = false OR
        assignee_id = current_user_id() OR
        reporter_id = current_user_id() OR
        is_tenant_admin(tenant_id, current_user_id())
    );
```

### Document Access with Expiration
```sql
CREATE POLICY documents_tenant ON documents
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );
```

## Testing RLS

```bash
# Connect to database
just db:shell

# Test without JWT claims (should return empty)
SELECT * FROM projects;

# Set claims and test
SET LOCAL request.jwt.claims.user_id = 'user-uuid';
SET LOCAL request.jwt.claims.tenant_id = 'tenant-uuid';
SELECT * FROM projects; -- Filtered results

# View RLS policies
just test:rls

# View row counts
just test:counts
```

## Command Reference

See `just help` for all available commands.

### Database Lifecycle
- `just db:up` - Start PostgreSQL
- `just db:down` - Stop PostgreSQL
- `just db:clean` - Remove all data
- `just db:shell` - Open psql

### Setup
- `just dev:setup` - Full setup
- `just dev:fresh` - Complete reset
- `just dev:refresh` - Remigrate + reseed

### Seeding
- `just db:seed` - Standard seed
- `just db:seed:minimal` - Minimal data
- `just db:seed:enterprise` - Enterprise scale

### Testing
- `just test:connection` - Test connection
- `just test:rls` - Show RLS policies
- `just test:counts` - Row counts
- `just test:simulate <user> <tenant>` - Simulate RLS

## Schema Diagram

```
tenants (multi-tenancy root)
├── users (global accounts)
│   └── tenant_memberships (role per tenant)
│       └── role_hierarchy (reporting structure)
├── projects
│   ├── project_members (team membership)
│   ├── project_shares (cross-tenant)
│   ├── tasks
│   │   └── task_dependencies
│   └── documents
│       ├── document_permissions (granular)
│       └── document_versions (audit)
├── comments
│   └── comment_mentions
├── approval_workflows
│   └── approval_steps
├── custom_roles
│   └── user_custom_roles
├── api_keys
├── notifications
└── audit_logs (immutable history)
```

## File Structure

```
test/
├── docker/
│   ├── docker-compose.yml    # PostgreSQL container
│   ├── Dockerfile            # Custom image
│   └── postgresql.conf       # Postgres settings
├── sql/
│   └── schema.sql            # Complete schema + RLS
├── src/
│   ├── migrate.ts            # Run migrations
│   ├── seed.ts               # Generate fake data
│   └── test-connection.ts    # Test connection
└── package.json              # Dependencies
```

## Customizing

### Add More Tables
1. Edit `test/sql/schema.sql`
2. Run `just db:migrate`

### Change Seed Data
1. Edit `test/src/seed.ts`
2. Run `just dev:refresh`

### Custom Connection String
```bash
export DATABASE_URL="postgres://user:pass@host:port/db"
just test:connection
```
