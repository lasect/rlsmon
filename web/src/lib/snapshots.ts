export interface SnapshotMeta {
	id: string;
	label: string;
	createdAt: string;
	tableCount: number;
	policyCount: number;
	roleCount: number;
}

export interface Snapshot {
	id: string;
	label: string;
	createdAt: string;
	policies: PolicyRow[];
	tables: TableRow[];
	roles: RoleRow[];
}

export interface PolicyRow {
	schemaname: string;
	tablename: string;
	policyname: string;
	permissive: string;
	roles: string | string[];
	cmd: string;
	qual: string | null;
	with_check: string | null;
}

export interface TableRow {
	schemaname: string;
	tablename: string;
	rowsecurity: boolean;
}

export interface RoleRow {
	rolname: string;
	rolcanlogin: boolean;
	rolsuper: boolean;
	rolbypassrls: boolean;
	rolinherit: boolean;
}

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

export function formatSnapshotTime(iso: string): string {
	const date = new Date(iso);
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

export function formatTimestampForInput(iso: string): string {
	const date = new Date(iso);
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

export type DiffSeverity = "critical" | "warning" | "info";

export function severityStyles(severity: DiffSeverity) {
	switch (severity) {
		case "critical":
			return {
				dot: "bg-destructive",
				text: "text-destructive",
				bg: "bg-destructive/10",
				border: "border-l-destructive",
			};
		case "warning":
			return {
				dot: "bg-warning",
				text: "text-warning",
				bg: "bg-warning/10",
				border: "border-l-warning",
			};
		case "info":
			return {
				dot: "bg-primary",
				text: "text-primary",
				bg: "bg-primary/10",
				border: "border-l-primary",
			};
	}
}
