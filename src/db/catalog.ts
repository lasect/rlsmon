import { catalogSql } from "./connection";

// Table information from information_schema
export interface TableInfo {
	schema: string;
	name: string;
	columns: ColumnInfo[];
}

export interface ColumnInfo {
	name: string;
	dataType: string;
	isNullable: boolean;
	defaultValue: string | null;
}

// Fetch all tables with their columns
export async function getTables(): Promise<TableInfo[]> {
	// Get all tables first
	const tables = await catalogSql`
		SELECT 
			t.table_schema as schema,
			t.table_name as name
		FROM information_schema.tables t
		WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
			AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_schema, t.table_name
	`;

	// Get columns for all tables in one query
	const columns = await catalogSql`
		SELECT 
			c.table_schema as schema,
			c.table_name as table_name,
			c.column_name as name,
			c.data_type as data_type,
			c.is_nullable = 'YES' as is_nullable,
			c.column_default as default_value
		FROM information_schema.columns c
		WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		ORDER BY c.table_schema, c.table_name, c.ordinal_position
	`;

	// Group columns by table
	const columnsByTable = new Map<string, ColumnInfo[]>();
	for (const col of columns) {
		const key = `${col.schema}.${col.table_name}`;
		if (!columnsByTable.has(key)) {
			columnsByTable.set(key, []);
		}
		columnsByTable.get(key)!.push({
			name: col.name,
			dataType: col.data_type,
			isNullable: col.is_nullable,
			defaultValue: col.default_value,
		});
	}

	// Build table objects
	return tables.map((t) => ({
		schema: t.schema,
		name: t.name,
		columns: columnsByTable.get(`${t.schema}.${t.name}`) || [],
	}));
}

// Role information
export interface RoleInfo {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	memberOf: string[];
}

// Fetch all roles and their inheritance
export async function getRoles(): Promise<RoleInfo[]> {
	// Get all roles
	const roles = await catalogSql`
		SELECT 
			r.rolname as name,
			r.rolsuper as is_superuser,
			r.rolcanlogin as can_login
		FROM pg_roles r
		WHERE r.rolname !~ '^pg_'
		ORDER BY r.rolname
	`;

	// Get role membership
	const memberships = await catalogSql`
		SELECT 
			r.rolname as role_name,
			m.rolname as member_of
		FROM pg_auth_members am
		JOIN pg_roles r ON r.oid = am.member
		JOIN pg_roles m ON m.oid = am.roleid
		WHERE r.rolname !~ '^pg_' AND m.rolname !~ '^pg_'
	`;

	// Group memberships by role
	const memberOfByRole = new Map<string, string[]>();
	for (const m of memberships) {
		if (!memberOfByRole.has(m.role_name)) {
			memberOfByRole.set(m.role_name, []);
		}
		memberOfByRole.get(m.role_name)!.push(m.member_of);
	}

	return roles.map((r) => ({
		name: r.name,
		isSuperuser: r.is_superuser,
		canLogin: r.can_login,
		memberOf: memberOfByRole.get(r.name) || [],
	}));
}

// Policy information
export interface PolicyInfo {
	schema: string;
	table: string;
	name: string;
	permissive: string;
	roles: string[];
	command: string;
	using: string | null;
	withCheck: string | null;
}

// Fetch all RLS policies
export async function getPolicies(): Promise<PolicyInfo[]> {
	const policies = await catalogSql`
		SELECT 
			schemata.schema_name as schema,
			tables.table_name as table,
			policies.policyname as name,
			policies.permissive as permissive,
			policies.roles as roles,
			policies.cmd as command,
			policies.qual as using,
			policies.with_check as with_check
		FROM pg_policies policies
		JOIN information_schema.tables tables 
			ON tables.table_schema = policies.schemaname 
			AND tables.table_name = policies.tablename
		JOIN information_schema.schemata schemata 
			ON schemata.schema_name = policies.schemaname
		WHERE policies.schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		ORDER BY policies.schemaname, policies.tablename, policies.policyname
	`;

	return policies.map((p) => ({
		schema: p.schema,
		table: p.table,
		name: p.name,
		permissive: p.permissive,
		roles: Array.isArray(p.roles) ? p.roles : [p.roles].filter(Boolean),
		command: p.command,
		using: p.using,
		withCheck: p.with_check,
	}));
}

// Check if RLS is enabled on a table
export async function isRlsEnabled(
	schema: string,
	table: string,
): Promise<boolean> {
	const result = await catalogSql`
		SELECT relrowsecurity as rls_enabled
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = ${schema} AND c.relname = ${table}
	`;
	return result[0]?.rls_enabled ?? false;
}

// Combined metadata for bootstrap
export interface MetaData {
	tables: TableInfo[];
	roles: RoleInfo[];
	policies: PolicyInfo[];
}

export async function getMeta(): Promise<MetaData> {
	const [tables, roles, policies] = await Promise.all([
		getTables(),
		getRoles(),
		getPolicies(),
	]);

	return { tables, roles, policies };
}
