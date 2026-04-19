import * as fs from "node:fs";
import * as path from "node:path";

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

function getSnapshotsDir(): string {
	return path.join(process.cwd(), ".rlsmon", "snapshots");
}

export function ensureSnapshotsDir(): string {
	const dir = getSnapshotsDir();
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function listSnapshots(): SnapshotMeta[] {
	const dir = getSnapshotsDir();
	if (!fs.existsSync(dir)) {
		return [];
	}

	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
	const snapshots: SnapshotMeta[] = [];

	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dir, file), "utf-8");
			const snap: Snapshot = JSON.parse(content);
			snapshots.push({
				id: snap.id,
				label: snap.label,
				createdAt: snap.createdAt,
				tableCount: snap.tables?.length ?? 0,
				policyCount: snap.policies?.length ?? 0,
				roleCount: snap.roles?.length ?? 0,
			});
		} catch {
			// Skip invalid files
		}
	}

	return snapshots.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

export function getSnapshot(id: string): Snapshot | null {
	const dir = getSnapshotsDir();
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

	for (const file of files) {
		if (file.includes(id)) {
			try {
				const content = fs.readFileSync(path.join(dir, file), "utf-8");
				return JSON.parse(content) as Snapshot;
			} catch {
				return null;
			}
		}
	}

	return null;
}

export function saveSnapshot(snapshot: Snapshot): void {
	const dir = ensureSnapshotsDir();
	const timestamp = new Date(snapshot.createdAt).getTime();
	const filename = `${timestamp}-${snapshot.id}.json`;
	const filepath = path.join(dir, filename);
	fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
}

export function deleteSnapshot(id: string): void {
	const dir = getSnapshotsDir();
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

	let found = false;
	for (const file of files) {
		if (file.includes(id)) {
			fs.unlinkSync(path.join(dir, file));
			found = true;
			break;
		}
	}

	if (!found) {
		throw new Error(`Snapshot not found: ${id}`);
	}
}

export function renameSnapshot(id: string, newLabel: string): void {
	const snapshot = getSnapshot(id);
	if (!snapshot) {
		throw new Error(`Snapshot not found: ${id}`);
	}
	snapshot.label = newLabel;
	saveSnapshot(snapshot);
}
