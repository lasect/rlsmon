-- ============================================================================
-- RLSMon Test Database Schema
-- Comprehensive RLS demonstration covering all real-world scenarios
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- 1. TENANT ISOLATION & BASE TABLES
-- ============================================================================

-- Organizations (tenants)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'suspended')),
    features JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    billing_email CITEXT,
    domain VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    max_projects INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    max_storage_bytes BIGINT DEFAULT 1073741824  -- 1GB
);

-- Create indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;
CREATE INDEX idx_tenants_subscription ON tenants(subscription_status);

-- Enable RLS on tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USER MANAGEMENT WITH ROLE-BASED ACCESS
-- ============================================================================

-- Users (global user accounts)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    is_email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    two_factor_enabled BOOLEAN DEFAULT false,
    locale VARCHAR(10) DEFAULT 'en-US',
    timezone VARCHAR(50) DEFAULT 'UTC'
);

-- Tenant memberships (links users to tenants with roles)
CREATE TABLE tenant_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer', 'guest')),
    department VARCHAR(100),
    job_title VARCHAR(100),
    permissions JSONB DEFAULT '{}',  -- Override permissions
    is_primary BOOLEAN DEFAULT false,  -- Primary tenant for user
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, user_id)
);

-- User roles hierarchy (for cascading permissions)
CREATE TABLE role_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reports_to UUID REFERENCES users(id),
    level INTEGER DEFAULT 0,  -- 0 = top level
    path LTREE,  -- Materialized path for tree traversal
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_role ON tenant_memberships(tenant_id, role);
CREATE INDEX idx_role_hierarchy_path ON role_hierarchy USING GIST (path);
CREATE INDEX idx_role_hierarchy_tenant_user ON role_hierarchy(tenant_id, user_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_hierarchy ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. PROJECTS WITH OWNERSHIP & TEAM-BASED ACCESS
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived', 'cancelled')),
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public', 'shared')),
    owner_id UUID NOT NULL REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    tags TEXT[],
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_template BOOLEAN DEFAULT false,
    template_id UUID REFERENCES projects(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id)
);

-- Project members (team-based access)
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer', 'client')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Project sharing (cross-tenant visibility)
CREATE TABLE project_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    shared_with_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(50) NOT NULL CHECK (share_type IN ('tenant', 'user', 'link')),
    permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}',
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT share_target_check CHECK (
        (share_type = 'tenant' AND shared_with_tenant_id IS NOT NULL AND shared_with_user_id IS NULL) OR
        (share_type = 'user' AND shared_with_tenant_id IS NULL AND shared_with_user_id IS NOT NULL) OR
        (share_type = 'link' AND shared_with_tenant_id IS NULL AND shared_with_user_id IS NULL)
    )
);

-- Create indexes
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_archived ON projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_shares_project ON project_shares(project_id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. TASKS WITH MULTI-LEVEL PERMISSIONS & ASSIGNMENTS
-- ============================================================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
    assignee_id UUID REFERENCES users(id),
    reporter_id UUID NOT NULL REFERENCES users(id),
    due_date DATE,
    estimated_hours DECIMAL(8, 2),
    actual_hours DECIMAL(8, 2),
    labels TEXT[],
    metadata JSONB DEFAULT '{}',
    is_private BOOLEAN DEFAULT false,  -- Only assignee and admins can see
    watcher_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id)
);

-- Task dependencies (linking tasks)
CREATE TABLE task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'blocked_by', 'relates_to', 'duplicates')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, depends_on_task_id)
);

-- Create indexes
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(tenant_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_private ON tasks(is_private) WHERE is_private = true;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. DOCUMENTS WITH PERMISSION LEVELS & VERSIONING
-- ============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    content_type VARCHAR(100) DEFAULT 'text/plain',
    file_size_bytes BIGINT,
    file_path VARCHAR(1000),
    mime_type VARCHAR(100),
    owner_id UUID NOT NULL REFERENCES users(id),
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'team', 'project', 'public')),
    permission_level VARCHAR(50) DEFAULT 'view' CHECK (permission_level IN ('none', 'view', 'comment', 'edit', 'admin')),
    is_template BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ  -- Time-based access
);

-- Document permissions (granular access control)
CREATE TABLE document_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID,  -- Could reference a custom roles table
    permission_level VARCHAR(50) NOT NULL CHECK (permission_level IN ('view', 'comment', 'edit', 'admin')),
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(document_id, user_id)
);

-- Document versions (audit trail)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT,
    file_path VARCHAR(1000),
    file_size_bytes BIGINT,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_visibility ON documents(visibility);
CREATE INDEX idx_documents_expires ON documents(expires_at);
CREATE INDEX idx_document_permissions_doc ON document_permissions(document_id);
CREATE INDEX idx_document_permissions_user ON document_permissions(user_id);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id, version);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. COMMENTS WITH NESTED STRUCTURE & OWNERSHIP
-- ============================================================================

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('project', 'task', 'document')),
    entity_id UUID NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    is_internal BOOLEAN DEFAULT false,  -- Internal notes (admins only)
    mentions UUID[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    reactions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

-- Comment mentions (for notification system)
CREATE TABLE comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, mentioned_user_id)
);

-- Create indexes
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_internal ON comments(is_internal) WHERE is_internal = true;
CREATE INDEX idx_comments_tenant ON comments(tenant_id);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. AUDIT LOG (IMMUTABLE)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255)
);

-- Create indexes
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Enable RLS on audit logs (users can only see their tenant's logs)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. APPROVAL WORKFLOWS
-- ============================================================================

CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('document', 'task', 'project', 'expense')),
    entity_id UUID NOT NULL,
    workflow_definition JSONB NOT NULL,  -- Steps, approvers, conditions
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected', 'cancelled')),
    current_step INTEGER DEFAULT 1,
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped', 'delegated')),
    comments TEXT,
    acted_at TIMESTAMPTZ,
    delegated_to UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, step_number, approver_id)
);

-- Create indexes
CREATE INDEX idx_approval_workflows_tenant ON approval_workflows(tenant_id);
CREATE INDEX idx_approval_workflows_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX idx_approval_workflows_status ON approval_workflows(status);
CREATE INDEX idx_approval_steps_workflow ON approval_steps(workflow_id);

-- Enable RLS
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. NOTIFICATIONS (USER-SPECIFIC)
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    action_url VARCHAR(1000),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. CUSTOM PERMISSIONS & ROLES
-- ============================================================================

CREATE TABLE custom_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE user_custom_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    custom_role_id UUID NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(tenant_id, user_id, custom_role_id)
);

-- Create indexes
CREATE INDEX idx_custom_roles_tenant ON custom_roles(tenant_id);
CREATE INDEX idx_user_custom_roles_user ON user_custom_roles(user_id);
CREATE INDEX idx_user_custom_roles_role ON user_custom_roles(custom_role_id);

-- Enable RLS
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. API KEYS & SERVICE ACCOUNTS
-- ============================================================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    permissions JSONB DEFAULT '{}',
    scopes TEXT[],
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Helper function to get current user ID from JWT claims
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claims.user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current tenant ID from JWT claims
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claims.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if user is admin in tenant
CREATE OR REPLACE FUNCTION is_tenant_admin(p_tenant_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_memberships
        WHERE tenant_id = p_tenant_id
        AND user_id = p_user_id
        AND role IN ('owner', 'admin')
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TENANTS POLICIES
-- ============================================================================

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

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY users_view_own ON users
    FOR SELECT
    USING (id = current_user_id());

CREATE POLICY users_view_tenant ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenant_memberships tm1
            JOIN tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
            WHERE tm1.user_id = current_user_id()
            AND tm2.user_id = users.id
            AND tm1.deleted_at IS NULL
            AND tm2.deleted_at IS NULL
        )
    );

CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = current_user_id())
    WITH CHECK (id = current_user_id());

-- ============================================================================
-- TENANT_MEMBERSHIPS POLICIES
-- ============================================================================

CREATE POLICY membership_tenant_isolation ON tenant_memberships
    FOR ALL
    USING (
        tenant_id = current_tenant_id() OR
        user_id = current_user_id() OR
        is_tenant_admin(tenant_id, current_user_id())
    );

-- ============================================================================
-- PROJECTS POLICIES
-- ============================================================================

-- Tenant isolation with soft delete
CREATE POLICY projects_tenant_isolation ON projects
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND deleted_at IS NULL
    );

-- Owner can do everything
CREATE POLICY projects_owner ON projects
    FOR ALL
    USING (owner_id = current_user_id());

-- Public visibility
CREATE POLICY projects_public ON projects
    FOR SELECT
    USING (
        visibility = 'public'
        AND deleted_at IS NULL
    );

-- Internal visibility (same tenant)
CREATE POLICY projects_internal ON projects
    FOR SELECT
    USING (
        visibility = 'internal'
        AND tenant_id = current_tenant_id()
        AND deleted_at IS NULL
    );

-- Project members can view
CREATE POLICY projects_member_view ON projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = projects.id
            AND user_id = current_user_id()
        )
        AND deleted_at IS NULL
    );

-- Shared projects
CREATE POLICY projects_shared ON projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_shares
            WHERE project_id = projects.id
            AND (
                (share_type = 'tenant' AND shared_with_tenant_id = current_tenant_id()) OR
                (share_type = 'user' AND shared_with_user_id = current_user_id())
            )
            AND (expires_at IS NULL OR expires_at > NOW())
        )
        AND deleted_at IS NULL
    );

-- ============================================================================
-- PROJECT_MEMBERS POLICIES
-- ============================================================================

CREATE POLICY project_members_tenant ON project_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_members.project_id
            AND tenant_id = current_tenant_id()
            AND deleted_at IS NULL
        )
    );

-- ============================================================================
-- TASKS POLICIES
-- ============================================================================

-- Base tenant isolation
CREATE POLICY tasks_tenant_isolation ON tasks
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND deleted_at IS NULL
    );

-- Private tasks (only assignee, reporter, and admins)
CREATE POLICY tasks_private ON tasks
    FOR SELECT
    USING (
        is_private = false OR
        assignee_id = current_user_id() OR
        reporter_id = current_user_id() OR
        is_tenant_admin(tenant_id, current_user_id())
    );

-- Assignee can update their tasks
CREATE POLICY tasks_assignee_update ON tasks
    FOR UPDATE
    USING (assignee_id = current_user_id())
    WITH CHECK (assignee_id = current_user_id());

-- Reporter can update their reported tasks
CREATE POLICY tasks_reporter_update ON tasks
    FOR UPDATE
    USING (reporter_id = current_user_id())
    WITH CHECK (reporter_id = current_user_id());

-- Project members can view tasks
CREATE POLICY tasks_project_member ON tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = tasks.project_id
            AND user_id = current_user_id()
        )
        AND deleted_at IS NULL
    );

-- Watchers can view
CREATE POLICY tasks_watcher ON tasks
    FOR SELECT
    USING (
        current_user_id() = ANY(watcher_ids)
    );

-- ============================================================================
-- DOCUMENTS POLICIES
-- ============================================================================

-- Tenant isolation
CREATE POLICY documents_tenant ON documents
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Owner full access
CREATE POLICY documents_owner ON documents
    FOR ALL
    USING (owner_id = current_user_id());

-- Public visibility
CREATE POLICY documents_public ON documents
    FOR SELECT
    USING (
        visibility = 'public'
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Team visibility (same tenant)
CREATE POLICY documents_team ON documents
    FOR SELECT
    USING (
        visibility = 'team'
        AND tenant_id = current_tenant_id()
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Project visibility
CREATE POLICY documents_project ON documents
    FOR SELECT
    USING (
        visibility = 'project'
        AND project_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = documents.project_id
            AND user_id = current_user_id()
        )
    );

-- Direct permissions
CREATE POLICY documents_permission ON documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_id = documents.id
            AND user_id = current_user_id()
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- ============================================================================
-- COMMENTS POLICIES
-- ============================================================================

-- Tenant isolation
CREATE POLICY comments_tenant ON comments
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND deleted_at IS NULL
    );

-- Author can edit/delete their own
CREATE POLICY comments_author ON comments
    FOR ALL
    USING (author_id = current_user_id());

-- Internal comments only for admins
CREATE POLICY comments_internal ON comments
    FOR SELECT
    USING (
        is_internal = false OR
        is_tenant_admin(tenant_id, current_user_id())
    );

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

-- Users can see their own actions
CREATE POLICY audit_own_actions ON audit_logs
    FOR SELECT
    USING (performed_by = current_user_id());

-- Admins can see all tenant audit logs
CREATE POLICY audit_tenant_admin ON audit_logs
    FOR SELECT
    USING (
        is_tenant_admin(tenant_id, current_user_id())
    );

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can only see their own notifications
CREATE POLICY notifications_user_isolation ON notifications
    FOR ALL
    USING (user_id = current_user_id());

-- ============================================================================
-- API KEYS POLICIES
-- ============================================================================

-- Users can see API keys they created
CREATE POLICY api_keys_creator ON api_keys
    FOR ALL
    USING (created_by = current_user_id());

-- Admins can see all tenant API keys
CREATE POLICY api_keys_admin ON api_keys
    FOR SELECT
    USING (
        is_tenant_admin(tenant_id, current_user_id())
    );

-- ============================================================================
-- TRIGGERS FOR AUDIT LOG
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
        changed_fields := ARRAY(SELECT jsonb_object_keys(new_data));
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        changed_fields := ARRAY(
            SELECT key
            FROM jsonb_each(old_data) old_vals
            JOIN jsonb_each(new_data) new_vals ON old_vals.key = new_vals.key
            WHERE old_vals.value IS DISTINCT FROM new_vals.value
        );
    ELSIF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
        changed_fields := ARRAY(SELECT jsonb_object_keys(old_data));
    END IF;

    INSERT INTO audit_logs (
        tenant_id,
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_fields,
        performed_by
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        old_data,
        new_data,
        changed_fields,
        current_user_id()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
CREATE TRIGGER audit_projects_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_tasks_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_documents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_comments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- DOCUMENT VERSIONING TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION document_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.version = OLD.version + 1;
        
        INSERT INTO document_versions (
            document_id,
            version,
            content,
            file_path,
            file_size_bytes,
            created_by
        ) VALUES (
            NEW.id,
            OLD.version,
            OLD.content,
            OLD.file_path,
            OLD.file_size_bytes,
            COALESCE(current_user_id(), NEW.owner_id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER document_version_trigger
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION document_version_trigger();

-- ============================================================================
-- UPDATE TIMESTAMPS TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tenant_memberships_updated_at BEFORE UPDATE ON tenant_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_project_members_updated_at BEFORE UPDATE ON project_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_approval_steps_updated_at BEFORE UPDATE ON approval_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_custom_roles_updated_at BEFORE UPDATE ON custom_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SOFT DELETE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete(table_name TEXT, record_id UUID, deleted_by UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET deleted_at = NOW(), deleted_by = %L WHERE id = %L AND deleted_at IS NULL',
        table_name, deleted_by, record_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- Active users with tenant info
CREATE VIEW v_user_tenants AS
SELECT 
    u.*,
    tm.tenant_id,
    tm.role as tenant_role,
    t.name as tenant_name,
    t.slug as tenant_slug
FROM users u
JOIN tenant_memberships tm ON u.id = tm.user_id
JOIN tenants t ON tm.tenant_id = t.id
WHERE u.deleted_at IS NULL
AND tm.deleted_at IS NULL
AND t.is_active = true;

-- Active projects with member count
CREATE VIEW v_project_summary AS
SELECT 
    p.*,
    COUNT(DISTINCT pm.user_id) as member_count,
    COUNT(DISTINCT t.id) as task_count,
    u.first_name || ' ' || u.last_name as owner_name
FROM projects p
LEFT JOIN project_members pm ON p.id = pm.project_id
LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
LEFT JOIN users u ON p.owner_id = u.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, u.first_name, u.last_name;

-- Tasks with assignee info
CREATE VIEW v_task_details AS
SELECT 
    t.*,
    p.name as project_name,
    p.visibility as project_visibility,
    assignee.first_name || ' ' || assignee.last_name as assignee_name,
    reporter.first_name || ' ' || reporter.last_name as reporter_name
FROM tasks t
JOIN projects p ON t.project_id = p.id
LEFT JOIN users assignee ON t.assignee_id = assignee.id
LEFT JOIN users reporter ON t.reporter_id = reporter.id
WHERE t.deleted_at IS NULL;
