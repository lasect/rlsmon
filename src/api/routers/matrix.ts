import { getPolicies, getRoles, getTables } from "../../db/catalog";
import { catalogSql } from "../../db/connection";
import { publicProcedure, router } from "../trpc";

// Access matrix cell
export interface AccessCell {
	tableSchema: string;
	tableName: string;
	role: string;
	select: boolean;
	insert: boolean;
	update: boolean;
	delete: boolean;
}

// Compute access matrix by analyzing policies
export async function computeAccessMatrix(): Promise<AccessCell[]> {
	const [tables, roles, policies] = await Promise.all([
		getTables(),
		getRoles(),
		getPolicies(),
	]);

	const matrix: AccessCell[] = [];

	for (const table of tables) {
		for (const role of roles) {
			// Find all policies applicable to this table and role
			const tablePolicies = policies.filter(
				(p) => p.schema === table.schema && p.table === table.name,
			);

			// Check if role is directly mentioned or is PUBLIC
			const applicablePolicies = tablePolicies.filter(
				(p) =>
					p.roles.includes("PUBLIC") ||
					p.roles.includes(role.name) ||
					role.memberOf.some((parent) => p.roles.includes(parent)),
			);

			// Check RLS is enabled on the table
			const rlsEnabledResult = await catalogSql`
				SELECT relrowsecurity 
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = ${table.schema} AND c.relname = ${table.name}
			`;
			const rlsEnabled = rlsEnabledResult[0]?.relrowsecurity ?? false;

			// If RLS is not enabled, all access is allowed (except for bypass roles)
			if (!rlsEnabled) {
				matrix.push({
					tableSchema: table.schema,
					tableName: table.name,
					role: role.name,
					select: true,
					insert: true,
					update: true,
					delete: true,
				});
				continue;
			}

			// Compute access based on policies
			const selectPolicies = applicablePolicies.filter(
				(p) => p.command === "SELECT",
			);
			const insertPolicies = applicablePolicies.filter(
				(p) => p.command === "INSERT",
			);
			const updatePolicies = applicablePolicies.filter(
				(p) => p.command === "UPDATE",
			);
			const deletePolicies = applicablePolicies.filter(
				(p) => p.command === "DELETE",
			);
			const allPolicies = applicablePolicies.filter((p) => p.command === "ALL");

			matrix.push({
				tableSchema: table.schema,
				tableName: table.name,
				role: role.name,
				select: selectPolicies.length > 0 || allPolicies.length > 0,
				insert: insertPolicies.length > 0 || allPolicies.length > 0,
				update: updatePolicies.length > 0 || allPolicies.length > 0,
				delete: deletePolicies.length > 0 || allPolicies.length > 0,
			});
		}
	}

	return matrix;
}

export const matrixRouter = router({
	get: publicProcedure.query(async () => {
		return computeAccessMatrix();
	}),
});
