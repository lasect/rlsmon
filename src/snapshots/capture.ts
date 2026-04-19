import { catalogSql } from "../db/connection";
import type { PolicyRow, RoleRow, Snapshot, TableRow } from "./storage";

function generateId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 6; i++) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	return result;
}

function formatTimestamp(date: Date): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const month = months[date.getMonth()];
	const day = date.getDate();
	const year = date.getFullYear();
	const hours = date.getHours();
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const ampm = hours >= 12 ? "PM" : "AM";
	const displayHours = hours % 12 || 12;
	return `${month} ${day} ${year}, ${displayHours}:${minutes} ${ampm}`;
}

export async function captureSnapshot(label?: string): Promise<Snapshot> {
	const now = new Date();

	const policiesResult = await catalogSql<PolicyRow[]>`
		SELECT 
			schemaname,
			tablename,
			policyname,
			permissive,
			roles,
			cmd,
			qual,
			with_check
		FROM pg_policies
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY schemaname, tablename, policyname
	`;

	const tablesResult = await catalogSql<TableRow[]>`
		SELECT 
			schemaname,
			tablename,
			rowsecurity
		FROM pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY schemaname, tablename
	`;

	const rolesResult = await catalogSql<RoleRow[]>`
		SELECT 
			rolname,
			rolcanlogin,
			rolsuper,
			rolbypassrls,
			rolinherit
		FROM pg_roles
		WHERE rolname NOT LIKE 'pg_%'
		ORDER BY rolname
	`;

	const snapshot: Snapshot = {
		id: generateId(),
		label: label ?? formatTimestamp(now),
		createdAt: now.toISOString(),
		policies: policiesResult.map((p) => ({
			schemaname: p.schemaname,
			tablename: p.tablename,
			policyname: p.policyname,
			permissive: p.permissive,
			roles: p.roles,
			cmd: p.cmd,
			qual: p.qual,
			with_check: p.with_check,
		})),
		tables: tablesResult.map((t) => ({
			schemaname: t.schemaname,
			tablename: t.tablename,
			rowsecurity: t.rowsecurity,
		})),
		roles: rolesResult.map((r) => ({
			rolname: r.rolname,
			rolcanlogin: r.rolcanlogin,
			rolsuper: r.rolsuper,
			rolbypassrls: r.rolbypassrls,
			rolinherit: r.rolinherit,
		})),
	};

	return snapshot;
}
