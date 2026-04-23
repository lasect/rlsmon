import {
	ArrowLeft,
	ChevronDown,
	ChevronRight,
	Minus,
	Plus,
	Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { Button } from "@/components/ui/button";
import { formatTimestampForInput } from "@/lib/snapshots";
import { cn } from "@/lib/utils";

function DiffSection({
	title,
	count,
	children,
	defaultExpanded = true,
}: {
	title: string;
	count: number;
	children: React.ReactNode;
	defaultExpanded?: boolean;
}) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	if (count === 0) return null;

	return (
		<div className="mt-3 overflow-hidden rounded border border-border/70">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/5"
			>
				<span className="font-medium text-sm">
					{title} · {count} change{count !== 1 ? "s" : ""}
				</span>
				{expanded ? (
					<ChevronDown className="size-4 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 text-muted-foreground" />
				)}
			</button>
			<div
				className={cn(
					"grid transition-all duration-150 ease-out",
					expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">{children}</div>
			</div>
		</div>
	);
}

function TableDiffEntry({
	change,
}: {
	change: { table: string; schema: string; before: boolean; after: boolean };
}) {
	const tableKey = `${change.schema}.${change.table}`;
	const isDisabling = change.before && !change.after;
	const isRlsChange = change.before !== change.after;

	if (isRlsChange) {
		return (
			<div className="flex items-center gap-2 border-border/30 border-b px-4 py-2 font-mono text-xs">
				<Shield
					className={cn(
						"size-3",
						isDisabling ? "text-destructive" : "text-green-400",
					)}
				/>
				<span
					className={cn(isDisabling ? "text-destructive" : "text-green-400")}
				>
					{tableKey}
				</span>
				<span className="text-muted-foreground">
					RLS {isDisabling ? "DISABLED" : "ENABLED"}
				</span>
				<span className="text-muted-foreground">
					({isDisabling ? "was enabled" : "was disabled"})
				</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 border-border/30 border-b px-4 py-2 font-mono text-xs">
			<Plus className="size-3 text-green-400" />
			<span className="text-green-400">{tableKey}</span>
		</div>
	);
}

function PolicyDiffEntry({
	policy,
	type,
}: {
	policy: {
		schemaname: string;
		tablename: string;
		policyname: string;
		cmd: string;
		qual: string | null;
		with_check: string | null;
	};
	type: "added" | "removed";
}) {
	const tableKey = `${policy.schemaname}.${policy.tablename}`;

	if (type === "added") {
		return (
			<div className="border-border/30 border-b px-4 py-2">
				<div className="flex items-center gap-2 font-mono text-xs">
					<Plus className="size-3 text-green-400" />
					<span className="text-green-400">{tableKey}</span>
					<span className="text-muted-foreground">→</span>
					<span className="text-green-400">{policy.policyname}</span>
					<span className="text-muted-foreground">[{policy.cmd}]</span>
				</div>
				{policy.qual && (
					<div className="mt-1 font-mono text-muted-foreground text-xs">
						USING: {policy.qual}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="border-border/30 border-b px-4 py-2">
			<div className="flex items-center gap-2 font-mono text-xs">
				<Minus className="size-3 text-destructive" />
				<span className="text-destructive">{tableKey}</span>
				<span className="text-muted-foreground">→</span>
				<span className="text-destructive">{policy.policyname}</span>
				<span className="text-muted-foreground">[{policy.cmd}]</span>
			</div>
			{policy.qual && (
				<div className="mt-1 font-mono text-muted-foreground text-xs">
					USING: {policy.qual}
				</div>
			)}
		</div>
	);
}

function PolicyChangeEntry({
	change,
}: {
	change: {
		before: {
			schemaname: string;
			tablename: string;
			policyname: string;
			cmd: string;
			qual: string | null;
			with_check: string | null;
		};
		after: {
			schemaname: string;
			tablename: string;
			policyname: string;
			cmd: string;
			qual: string | null;
			with_check: string | null;
		};
		changedFields: string[];
	};
}) {
	const tableKey = `${change.before.schemaname}.${change.before.tablename}`;

	return (
		<div className="border-border/30 border-b px-4 py-2">
			<div className="flex items-center gap-2 font-mono text-xs">
				<Shield className="size-3 text-warning" />
				<span className="text-warning">{tableKey}</span>
				<span className="text-muted-foreground">→</span>
				<span className="text-warning">{change.before.policyname}</span>
				<span className="text-muted-foreground">[{change.before.cmd}]</span>
			</div>
			<div className="mt-1.5 space-y-1">
				{change.changedFields.includes("qual") && (
					<div className="ml-4 font-mono text-xs">
						<span className="text-muted-foreground">USING changed:</span>
						<div className="mt-1 rounded bg-destructive/10 px-2 py-1 text-red-400">
							before: {change.before.qual ?? "(null)"}
						</div>
						<div className="mt-1 rounded bg-green-500/10 px-2 py-1 text-green-400">
							after: {change.after.qual ?? "(null)"}
						</div>
					</div>
				)}
				{change.changedFields.includes("with_check") && (
					<div className="ml-4 font-mono text-xs">
						<span className="text-muted-foreground">WITH CHECK changed:</span>
						<div className="mt-1 rounded bg-destructive/10 px-2 py-1 text-red-400">
							before: {change.before.with_check ?? "(null)"}
						</div>
						<div className="mt-1 rounded bg-green-500/10 px-2 py-1 text-green-400">
							after: {change.after.with_check ?? "(null)"}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function RoleDiffEntry({
	role,
	type,
}: {
	role: { rolname: string };
	type: "added" | "removed";
}) {
	return (
		<div className="flex items-center gap-2 border-border/30 border-b px-4 py-2 font-mono text-xs">
			{type === "added" ? (
				<>
					<Plus className="size-3 text-green-400" />
					<span className="text-green-400">{role.rolname}</span>
				</>
			) : (
				<>
					<Minus className="size-3 text-destructive" />
					<span className="text-destructive">{role.rolname}</span>
				</>
			)}
		</div>
	);
}

function RoleChangeEntry({
	change,
}: {
	change: {
		before: { rolname: string; rolsuper: boolean; rolbypassrls: boolean };
		after: { rolname: string; rolsuper: boolean; rolbypassrls: boolean };
		changedFields: string[];
	};
}) {
	return (
		<div className="flex items-center gap-2 border-border/30 border-b px-4 py-2 font-mono text-xs">
			<Shield className="size-3 text-warning" />
			<span className="text-warning">{change.before.rolname}</span>
			<span className="text-muted-foreground">
				{change.changedFields.join(", ")}: {String(change.before.rolbypassrls)}{" "}
				→ {String(change.after.rolbypassrls)}
			</span>
		</div>
	);
}

export function SnapshotDetailPage() {
	const { snapshotId } = useParams();
	const [searchParams] = useSearchParams();
	const compareId = searchParams.get("compare");

	const snapshotQuery = trpc.snapshots.get.useQuery(
		{ id: snapshotId ?? "" },
		{ enabled: !!snapshotId },
	);
	const compareSnapshotQuery = trpc.snapshots.get.useQuery(
		{ id: compareId ?? "" },
		{ enabled: !!compareId },
	);
	const diffQuery = trpc.snapshots.diff.useQuery(
		{ idA: compareId ?? "", idB: snapshotId ?? "" },
		{ enabled: !!compareId && !!snapshotId },
	);

	const snapshot = snapshotQuery.data;
	const compareSnapshot = compareSnapshotQuery.data;
	const diff = diffQuery.data;

	const isLoading =
		snapshotQuery.isLoading ||
		compareSnapshotQuery.isLoading ||
		(!!compareId && diffQuery.isLoading);
	const error = diffQuery.error;

	const tableChanges = useMemo(() => {
		if (!diff) return 0;
		return (
			diff.tables.added.length +
			diff.tables.removed.length +
			diff.tables.rlsChanged.length
		);
	}, [diff]);

	const policyChanges = useMemo(() => {
		if (!diff) return 0;
		return (
			diff.policies.added.length +
			diff.policies.removed.length +
			diff.policies.changed.length
		);
	}, [diff]);

	const roleChanges = useMemo(() => {
		if (!diff) return 0;
		return (
			diff.roles.added.length +
			diff.roles.removed.length +
			diff.roles.changed.length
		);
	}, [diff]);

	if (!snapshotId) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-muted-foreground text-sm">No snapshot selected</p>
			</div>
		);
	}

	if (snapshotQuery.isError) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
					{snapshotQuery.error.message}
				</div>
			</div>
		);
	}

	if (!compareId) {
		return (
			<div className="flex h-full flex-col overflow-hidden px-4 pt-3 pb-4">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild>
						<Link to="/history">
							<ArrowLeft className="mr-1 size-4" />
							Snapshots
						</Link>
					</Button>
				</div>

				<div className="mt-3">
					<h1 className="font-semibold text-lg">
						{snapshot?.label ?? "Loading..."}
					</h1>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{snapshot?.createdAt
							? formatTimestampForInput(snapshot.createdAt)
							: "Loading..."}
					</p>
				</div>

				<div className="mt-4 grid grid-cols-3 gap-3">
					<div className="rounded border border-border/50 bg-card px-4 py-3">
						<div className="text-muted-foreground text-xs">Tables</div>
						<div className="mt-1 font-semibold text-lg">
							{snapshot?.tableCount ?? "-"}
						</div>
					</div>
					<div className="rounded border border-border/50 bg-card px-4 py-3">
						<div className="text-muted-foreground text-xs">Policies</div>
						<div className="mt-1 font-semibold text-lg">
							{snapshot?.policyCount ?? "-"}
						</div>
					</div>
					<div className="rounded border border-border/50 bg-card px-4 py-3">
						<div className="text-muted-foreground text-xs">Roles</div>
						<div className="mt-1 font-semibold text-lg">
							{snapshot?.roleCount ?? "-"}
						</div>
					</div>
				</div>

				<p className="mt-6 text-muted-foreground text-xs">
					Select a snapshot to compare with this one from the Snapshots page.
				</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
					{error.message}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden px-4 pt-3 pb-4">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/history">
						<ArrowLeft className="mr-1 size-4" />
						Snapshots
					</Link>
				</Button>
			</div>

			<div className="mt-3 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="font-semibold text-sm">
						{compareSnapshot?.label ?? "Loading..."} →{" "}
						{snapshot?.label ?? "Loading..."}
					</h1>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{compareSnapshot?.createdAt && snapshot?.createdAt
							? `${formatTimestampForInput(compareSnapshot.createdAt)} vs ${formatTimestampForInput(snapshot.createdAt)}`
							: "Loading timestamps..."}
					</p>
				</div>

				{!isLoading && diff && (
					<div className="text-xs">
						{diff.summary.totalChanges === 0 ? (
							<span className="text-green-400">No changes detected</span>
						) : (
							<>
								<span className="text-destructive">
									{diff.summary.critical} critical
								</span>
								{" · "}
								<span className="text-warning">
									{diff.summary.warning} warning
								</span>
								{" · "}
								<span className="text-primary">{diff.summary.info} info</span>
								{" · "}
								<span className="text-muted-foreground">
									{diff.summary.totalChanges} total
								</span>
							</>
						)}
					</div>
				)}
			</div>

			{isLoading ? (
				<div className="mt-4 space-y-2">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-16 animate-pulse rounded border border-border/50 bg-card"
						/>
					))}
				</div>
			) : diff && diff.summary.totalChanges === 0 ? (
				<div className="mt-8 flex flex-1 flex-col items-center justify-center">
					<Shield className="mb-3 size-10 text-green-400/30" />
					<p className="font-medium text-sm">
						No changes detected between these snapshots
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Your RLS configuration is identical between these two points in time
					</p>
				</div>
			) : (
				diff && (
					<>
						<DiffSection title="Tables" count={tableChanges}>
							<div className="space-y-0">
								{diff.tables.rlsChanged.map((change, i) => (
									<TableDiffEntry key={`rls-${i}`} change={change} />
								))}
								{diff.tables.added.map((table, i) => (
									<TableDiffEntry
										key={`added-${i}`}
										change={{
											table: table.tablename,
											schema: table.schemaname,
											before: false,
											after: true,
										}}
									/>
								))}
								{diff.tables.removed.map((table, i) => (
									<TableDiffEntry
										key={`removed-${i}`}
										change={{
											table: table.tablename,
											schema: table.schemaname,
											before: true,
											after: false,
										}}
									/>
								))}
							</div>
						</DiffSection>

						<DiffSection title="Policies" count={policyChanges}>
							<div className="space-y-0">
								{diff.policies.added.map((policy, i) => (
									<PolicyDiffEntry
										key={`added-${i}`}
										policy={policy}
										type="added"
									/>
								))}
								{diff.policies.removed.map((policy, i) => (
									<PolicyDiffEntry
										key={`removed-${i}`}
										policy={policy}
										type="removed"
									/>
								))}
								{diff.policies.changed.map((change, i) => (
									<PolicyChangeEntry key={`changed-${i}`} change={change} />
								))}
							</div>
						</DiffSection>

						<DiffSection
							title="Roles"
							count={roleChanges}
							defaultExpanded={false}
						>
							<div className="space-y-0">
								{diff.roles.added.map((role, i) => (
									<RoleDiffEntry key={`added-${i}`} role={role} type="added" />
								))}
								{diff.roles.removed.map((role, i) => (
									<RoleDiffEntry
										key={`removed-${i}`}
										role={role}
										type="removed"
									/>
								))}
								{diff.roles.changed.map((change, i) => (
									<RoleChangeEntry key={`changed-${i}`} change={change} />
								))}
							</div>
						</DiffSection>
					</>
				)
			)}
		</div>
	);
}
