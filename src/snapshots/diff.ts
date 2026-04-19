import type { PolicyRow, RoleRow, Snapshot, TableRow } from "./storage";

export interface DiffResult {
	policies: {
		added: PolicyRow[];
		removed: PolicyRow[];
		changed: Array<{
			before: PolicyRow;
			after: PolicyRow;
			changedFields: string[];
		}>;
	};
	tables: {
		added: TableRow[];
		removed: TableRow[];
		rlsChanged: Array<{
			table: string;
			schema: string;
			before: boolean;
			after: boolean;
		}>;
	};
	roles: {
		added: RoleRow[];
		removed: RoleRow[];
		changed: Array<{
			before: RoleRow;
			after: RoleRow;
			changedFields: string[];
		}>;
	};
	summary: {
		totalChanges: number;
		critical: number;
		warning: number;
		info: number;
	};
}

function policyKey(p: PolicyRow): string {
	return `${p.schemaname}.${p.tablename}.${p.policyname}`;
}

function tableKey(t: TableRow): string {
	return `${t.schemaname}.${t.tablename}`;
}

function roleKey(r: RoleRow): string {
	return r.rolname;
}

function findPolicyChanges(
	before: PolicyRow[],
	after: PolicyRow[],
): Array<{ before: PolicyRow; after: PolicyRow; changedFields: string[] }> {
	const changes: Array<{
		before: PolicyRow;
		after: PolicyRow;
		changedFields: string[];
	}> = [];

	const beforeMap = new Map(before.map((p) => [policyKey(p), p]));
	const afterMap = new Map(after.map((p) => [policyKey(p), p]));

	for (const [key, afterPolicy] of afterMap) {
		const beforePolicy = beforeMap.get(key);
		if (!beforePolicy) continue;

		const changedFields: string[] = [];
		if (beforePolicy.qual !== afterPolicy.qual) changedFields.push("qual");
		if (beforePolicy.with_check !== afterPolicy.with_check)
			changedFields.push("with_check");
		if (beforePolicy.cmd !== afterPolicy.cmd) changedFields.push("cmd");
		if (
			JSON.stringify(beforePolicy.roles) !== JSON.stringify(afterPolicy.roles)
		)
			changedFields.push("roles");

		if (changedFields.length > 0) {
			changes.push({ before: beforePolicy, after: afterPolicy, changedFields });
		}
	}

	return changes;
}

function findRLSChanges(
	before: TableRow[],
	after: TableRow[],
): Array<{ table: string; schema: string; before: boolean; after: boolean }> {
	const changes: Array<{
		table: string;
		schema: string;
		before: boolean;
		after: boolean;
	}> = [];

	const beforeMap = new Map(before.map((t) => [tableKey(t), t]));
	const afterMap = new Map(after.map((t) => [tableKey(t), t]));

	for (const [key, afterTable] of afterMap) {
		const beforeTable = beforeMap.get(key);
		if (!beforeTable) continue;

		if (beforeTable.rowsecurity !== afterTable.rowsecurity) {
			changes.push({
				table: afterTable.tablename,
				schema: afterTable.schemaname,
				before: beforeTable.rowsecurity,
				after: afterTable.rowsecurity,
			});
		}
	}

	return changes;
}

function findRoleChanges(
	before: RoleRow[],
	after: RoleRow[],
): Array<{ before: RoleRow; after: RoleRow; changedFields: string[] }> {
	const changes: Array<{
		before: RoleRow;
		after: RoleRow;
		changedFields: string[];
	}> = [];

	const beforeMap = new Map(before.map((r) => [roleKey(r), r]));
	const afterMap = new Map(after.map((r) => [roleKey(r), r]));

	for (const [key, afterRole] of afterMap) {
		const beforeRole = beforeMap.get(key);
		if (!beforeRole) continue;

		const changedFields: string[] = [];
		if (beforeRole.rolsuper !== afterRole.rolsuper)
			changedFields.push("rolsuper");
		if (beforeRole.rolbypassrls !== afterRole.rolbypassrls)
			changedFields.push("rolbypassrls");
		if (beforeRole.rolcanlogin !== afterRole.rolcanlogin)
			changedFields.push("rolcanlogin");
		if (beforeRole.rolinherit !== afterRole.rolinherit)
			changedFields.push("rolinherit");

		if (changedFields.length > 0) {
			changes.push({ before: beforeRole, after: afterRole, changedFields });
		}
	}

	return changes;
}

export function diffSnapshots(
	snapshotA: Snapshot,
	snapshotB: Snapshot,
): DiffResult {
	const before = snapshotA;
	const after = snapshotB;

	const beforePolicySet = new Set(before.policies.map(policyKey));
	const afterPolicySet = new Set(after.policies.map(policyKey));

	const addedPolicies = after.policies.filter(
		(p) => !beforePolicySet.has(policyKey(p)),
	);
	const removedPolicies = before.policies.filter(
		(p) => !afterPolicySet.has(policyKey(p)),
	);
	const policyChanges = findPolicyChanges(before.policies, after.policies);

	const beforeTableSet = new Set(before.tables.map(tableKey));
	const afterTableSet = new Set(after.tables.map(tableKey));

	const addedTables = after.tables.filter(
		(t) => !beforeTableSet.has(tableKey(t)),
	);
	const removedTables = before.tables.filter(
		(t) => !afterTableSet.has(tableKey(t)),
	);
	const rlsChanges = findRLSChanges(before.tables, after.tables);

	const beforeRoleSet = new Set(before.roles.map(roleKey));
	const afterRoleSet = new Set(after.roles.map(roleKey));

	const addedRoles = after.roles.filter((r) => !beforeRoleSet.has(roleKey(r)));
	const removedRoles = before.roles.filter(
		(r) => !afterRoleSet.has(roleKey(r)),
	);
	const roleChanges = findRoleChanges(before.roles, after.roles);

	let critical = 0;
	let warning = 0;
	let info = 0;

	for (const change of rlsChanges) {
		if (change.before && !change.after) {
			critical++;
		} else if (!change.before && change.after) {
			info++;
		}
	}

	for (const policy of removedPolicies) {
		const tableKey_ = `${policy.schemaname}.${policy.tablename}`;
		const table = after.tables.find((t) => tableKey(t) === tableKey_);
		if (table?.rowsecurity) {
			critical++;
		}
	}

	for (const _ of addedPolicies) {
		info++;
	}

	for (const _ of policyChanges) {
		warning++;
	}

	for (const _ of addedTables) {
		info++;
	}

	for (const removed of removedTables) {
		const tableKey_ = `${removed.schemaname}.${removed.tablename}`;
		const oldTable = before.tables.find((t) => tableKey(t) === tableKey_);
		if (oldTable?.rowsecurity) {
			critical++;
		}
	}

	for (const _ of addedRoles) {
		info++;
	}

	for (const _ of removedRoles) {
		critical++;
	}

	for (const change of roleChanges) {
		if (change.changedFields.includes("rolbypassrls")) {
			warning++;
		} else if (change.changedFields.includes("rolsuper")) {
			warning++;
		}
	}

	const totalChanges =
		addedPolicies.length +
		removedPolicies.length +
		policyChanges.length +
		addedTables.length +
		removedTables.length +
		rlsChanges.length +
		addedRoles.length +
		removedRoles.length +
		roleChanges.length;

	return {
		policies: {
			added: addedPolicies,
			removed: removedPolicies,
			changed: policyChanges,
		},
		tables: {
			added: addedTables,
			removed: removedTables,
			rlsChanged: rlsChanges,
		},
		roles: {
			added: addedRoles,
			removed: removedRoles,
			changed: roleChanges,
		},
		summary: {
			totalChanges,
			critical,
			warning,
			info,
		},
	};
}
