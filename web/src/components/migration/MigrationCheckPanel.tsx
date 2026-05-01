import {
	CheckCircle,
	FileText,
	Loader2,
	ShieldAlert,
	ShieldCheck,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { Badge } from "@/components/ui/badge";
import type { SnapshotMeta } from "@/lib/snapshots";
import { cn } from "@/lib/utils";

export interface SafetyFinding {
	severity: "critical" | "warning" | "info";
	table: string;
	schema: string;
	operation: string;
	message: string;
	detail: string;
	affectedPolicies: string[];
}

export interface TableCheckResult {
	schema: string;
	table: string;
	hasRls: boolean;
	policyCount: number;
	policies: string[];
	operations: string[];
}

export interface SafetyResult {
	findings: SafetyFinding[];
	tablesChecked: TableCheckResult[];
	summary: {
		critical: number;
		warning: number;
		info: number;
		tablesScanned: number;
		tablesWithRls: number;
	};
	checkedAgainst: "live" | "snapshot";
	snapshotLabel?: string;
}

export interface ParsedMigration {
	tables: Array<{ schema: string; table: string; operations: string[] }>;
	rawStatements: string[];
}

interface MigrationCheckPanelProps {
	mode?: "full" | "embedded";
	defaultSnapshotId?: string;
	snapshots?: SnapshotMeta[];
	onSnapshotSelect?: (id: string) => void;
}

export function MigrationCheckPanel({
	mode = "full",
	defaultSnapshotId,
	snapshots: propSnapshots,
}: MigrationCheckPanelProps) {
	const navigate = useNavigate();
	const [sql, setSql] = useState("");
	const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
	const [checkAgainst, setCheckAgainst] = useState<"live" | "snapshot">("live");
	const [selectedSnapshotId, setSelectedSnapshotId] = useState<
		string | undefined
	>(defaultSnapshotId);
	const [filename, setFilename] = useState<string | null>(null);
	const [parseResult, setParseResult] = useState<ParsedMigration | null>(null);

	const utils = trpc.useUtils();
	const snapshotsQuery = trpc.snapshots.list.useQuery(undefined, {
		enabled: !propSnapshots,
	});

	const snapshots = useMemo(
		() => propSnapshots ?? snapshotsQuery.data ?? [],
		[propSnapshots, snapshotsQuery.data],
	);

	const parseMutation = trpc.migrationCheck.parse.useMutation();
	const checkMutation = trpc.migrationCheck.check.useMutation({
		onSuccess: () => {
			utils.invalidate(["snapshots.list"]);
		},
	});

	const selectedSnapshot = useMemo(
		() => snapshots.find((s) => s.id === selectedSnapshotId),
		[snapshots, selectedSnapshotId],
	);

	useEffect(() => {
		const timer = setTimeout(() => {
			if (sql.trim().length > 0) {
				parseMutation.mutate(
					{ sql },
					{
						onSuccess: (result) => setParseResult(result),
						onError: () => setParseResult(null),
					},
				);
			} else {
				setParseResult(null);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [sql, parseMutation]);

	const handleFileUpload = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			setSql(content);
			setFilename(file.name);
			setInputMode("paste");
		};
		reader.readAsText(file);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const file = e.dataTransfer.files[0];
			if (file) {
				handleFileUpload(file);
			}
		},
		[handleFileUpload],
	);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFileUpload(file);
			}
		},
		[handleFileUpload],
	);

	const handleCheck = useCallback(() => {
		checkMutation.mutate({
			sql,
			snapshotId: checkAgainst === "snapshot" ? selectedSnapshotId : undefined,
		});
	}, [sql, checkAgainst, selectedSnapshotId, checkMutation]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if (sql.trim() && !checkMutation.isPending) {
					handleCheck();
				}
			}
		},
		[sql, checkMutation.isPending, handleCheck],
	);

	const detectedTablesText = useMemo(() => {
		if (!parseResult || parseResult.tables.length === 0) return null;
		return parseResult.tables.map((t) => `${t.schema}.${t.table}`).join(", ");
	}, [parseResult]);

	const isLoading = checkMutation.isPending;

	return (
		<div className="flex h-full gap-1">
			<div className="flex w-[400px] shrink-0 flex-col">
				<div className="mb-2 flex gap-1">
					<button
						type="button"
						onClick={() => setInputMode("paste")}
						className={cn(
							"rounded px-2.5 py-1 font-medium text-xs transition-colors",
							inputMode === "paste"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
						)}
					>
						Paste SQL
					</button>
					<button
						type="button"
						onClick={() => setInputMode("upload")}
						className={cn(
							"rounded px-2.5 py-1 font-medium text-xs transition-colors",
							inputMode === "upload"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
						)}
					>
						Upload .sql
					</button>
				</div>

				{inputMode === "paste" ? (
					<div className="relative flex-1">
						<textarea
							value={sql}
							onChange={(e) => setSql(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={
								"-- Paste your migration SQL here\nALTER TABLE users...\nDROP POLICY..."
							}
							className="h-[280px] w-full resize-none rounded border border-border bg-[#0a0a0a] p-3 font-mono text-foreground text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
						/>
						{detectedTablesText && (
							<p className="mt-2 truncate text-muted-foreground text-xs">
								Detected tables: {detectedTablesText}
							</p>
						)}
					</div>
				) : (
					<label
						onDrop={handleDrop}
						onDragOver={(e) => e.preventDefault()}
						className="flex h-[280px] cursor-pointer flex-col items-center justify-center rounded border border-white/20 border-dashed transition-colors hover:border-white/40 hover:bg-white/5"
					>
						<input
							type="file"
							accept=".sql,.txt"
							onChange={handleFileChange}
							className="hidden"
						/>
						<Upload className="mb-2 size-8 text-muted-foreground/50" />
						<p className="text-muted-foreground text-xs">
							Drop your .sql file here
						</p>
						<p className="mt-1 text-muted-foreground/50 text-xs">
							or click to browse
						</p>
					</label>
				)}

				{filename && inputMode === "paste" && (
					<p className="mt-2 text-green-400 text-xs">{filename} loaded</p>
				)}

				<div className="mt-0 rounded-lg border border-border/50 bg-card p-3">
					<div className="space-y-4">
						<div>
							<label className="mb-1.5 block font-medium text-muted-foreground text-xs">
								Target
							</label>
							<select
								value={checkAgainst}
								onChange={(e) =>
									setCheckAgainst(e.target.value as "live" | "snapshot")
								}
								disabled={snapshots.length === 0}
								className={cn(
									"w-full rounded border border-border bg-[#0a0a0a] px-2.5 py-1.5 text-foreground text-xs",
									"focus:border-primary focus:outline-none",
									snapshots.length === 0 && "cursor-not-allowed opacity-50",
								)}
							>
								<option value="live">Live Database</option>
								<option value="snapshot" disabled={snapshots.length === 0}>
									Snapshot
								</option>
							</select>
						</div>

						{checkAgainst === "snapshot" && (
							<div>
								<label className="mb-1.5 block font-medium text-muted-foreground text-xs">
									Snapshot
								</label>
								<select
									value={selectedSnapshotId || ""}
									onChange={(e) => setSelectedSnapshotId(e.target.value)}
									className="w-full rounded border border-border bg-[#0a0a0a] px-2.5 py-1.5 text-foreground text-xs focus:border-primary focus:outline-none"
								>
									<option value="">Select a snapshot...</option>
									{snapshots.map((s) => (
										<option key={s.id} value={s.id}>
											{s.label} · {s.createdAt}
										</option>
									))}
								</select>
							</div>
						)}

						{snapshots.length === 0 && (
							<p className="text-muted-foreground text-xs">
								No snapshots available
							</p>
						)}

						<p className="text-muted-foreground/60 text-xs">
							Comparing SQL against{" "}
							{checkAgainst === "snapshot" && selectedSnapshot
								? selectedSnapshot.label
								: "Live Database"}
						</p>

						<div className="space-y-1.5">
							<button
								type="button"
								onClick={handleCheck}
								disabled={!sql.trim() || isLoading}
								className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700/90 px-3 py-1.5 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
							>
								{isLoading ? (
									<>
										<Loader2 className="size-3 animate-spin text-emerald-100" />
										<span className="font-mono font-semibold text-[11px] text-emerald-50">
											Checking...
										</span>
									</>
								) : (
									<span className="font-mono font-semibold text-[11px] text-emerald-50">
										Check Migration
									</span>
								)}
							</button>
							<p className="text-center text-muted-foreground/50 text-xs">
								⌘+Enter to run
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{!checkMutation.data && !isLoading && !checkMutation.error && (
					<div className="flex h-full flex-col items-center justify-center">
						<FileText className="mb-3 size-10 text-muted-foreground/30" />
						<p className="text-muted-foreground text-sm">
							Paste a migration to check it
						</p>
						<p className="mt-1 text-muted-foreground/70 text-xs">
							We'll warn you if your migration touches RLS-protected tables
						</p>
					</div>
				)}

				{isLoading && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
							<span className="text-sm">
								{parseMutation.isPending
									? "Parsing migration..."
									: "Checking against database..."}
							</span>
						</div>
						<div className="space-y-2">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="h-12 animate-pulse rounded border border-border/50 bg-card"
								/>
							))}
						</div>
					</div>
				)}

				{checkMutation.error && (
					<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
						{checkMutation.error.message}
					</div>
				)}

				{checkMutation.data && (
					<ResultsView result={checkMutation.data} mode={mode} />
				)}
			</div>
		</div>
	);
}

function ResultsView({
	result,
	mode,
}: {
	result: SafetyResult;
	mode?: "full" | "embedded";
}) {
	const { summary, tablesChecked, findings, checkedAgainst, snapshotLabel } =
		result;
	const navigate = useNavigate();

	const critical = summary.critical;
	const warning = summary.warning;
	const info = summary.info;

	const groupedFindings = useMemo(() => {
		const grouped = {
			critical: findings.filter((f) => f.severity === "critical"),
			warning: findings.filter((f) => f.severity === "warning"),
			info: findings.filter((f) => f.severity === "info"),
		};
		return grouped;
	}, [findings]);

	const isSafe = critical === 0 && warning === 0;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3 text-sm">
					{critical > 0 && (
						<span className="text-destructive">{critical} critical</span>
					)}
					{critical > 0 && warning > 0 && <span>·</span>}
					{warning > 0 && (
						<span className="text-warning">{warning} warning</span>
					)}
					{(critical > 0 || warning > 0) && info > 0 && <span>·</span>}
					{info > 0 && <span className="text-primary">{info} info</span>}
					<span>·</span>
					<span className="text-muted-foreground">
						{summary.tablesScanned} tables scanned
					</span>
					<span>·</span>
					<span className="text-green-400">
						{summary.tablesWithRls} with RLS
					</span>
				</div>
				<div className="text-muted-foreground text-xs">
					{checkedAgainst === "snapshot" && snapshotLabel ? (
						<span>Snapshot: {snapshotLabel}</span>
					) : (
						<span>Checked against: Live database</span>
					)}
				</div>
			</div>

			{tablesChecked.length > 0 && (
				<div className="rounded border border-border/70">
					<div className="border-border/70 border-b px-3 py-2 font-medium text-xs">
						Tables Scanned
					</div>
					<div className="max-h-40 overflow-y-auto">
						{tablesChecked.map((t, i) => (
							<div
								key={i}
								className="flex items-center gap-2 border-border/30 border-b px-3 py-1.5 last:border-b-0"
							>
								{t.hasRls ? (
									<span className="size-2 rounded-full bg-green-400" />
								) : (
									<span className="size-2 rounded-full bg-white/20" />
								)}
								<code className="font-mono text-xs">
									{t.schema}.{t.table}
								</code>
								<span className="ml-auto text-muted-foreground text-xs">
									{t.hasRls
										? `RLS enabled · ${t.policyCount} policies`
										: "No RLS"}
								</span>
								<div className="flex gap-1">
									{t.operations.map((op, j) => (
										<Badge
											key={j}
											variant="outline"
											className="font-mono text-[10px]"
										>
											{op}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{isSafe && (
				<div className="flex flex-col items-center rounded-lg border border-green-500/20 bg-green-950/30 p-6">
					<CheckCircle className="mb-2 size-8 text-green-400" />
					<p className="font-medium text-green-300 text-sm">
						Migration looks safe
					</p>
					<p className="mt-1 text-center text-muted-foreground text-xs">
						No RLS-protected tables are affected by dangerous operations
					</p>
				</div>
			)}

			{!isSafe && (
				<div className="space-y-2">
					{groupedFindings.critical.length > 0 && (
						<div className="space-y-1.5">
							{groupedFindings.critical.map((f, i) => (
								<FindingCard
									key={`critical-${i}`}
									finding={f}
									onViewPolicies={() =>
										navigate(
											`/explore/policies?table=${encodeURIComponent(
												`${f.schema}.${f.table}`,
											)}`,
										)
									}
								/>
							))}
						</div>
					)}

					{groupedFindings.warning.length > 0 && (
						<div className="space-y-1.5">
							{groupedFindings.warning.map((f, i) => (
								<FindingCard
									key={`warning-${i}`}
									finding={f}
									onViewPolicies={() =>
										navigate(
											`/explore/policies?table=${encodeURIComponent(
												`${f.schema}.${f.table}`,
											)}`,
										)
									}
								/>
							))}
						</div>
					)}

					{groupedFindings.info.length > 0 && (
						<div className="space-y-1.5">
							{groupedFindings.info.map((f, i) => (
								<FindingCard
									key={`info-${i}`}
									finding={f}
									onViewPolicies={() =>
										navigate(
											`/explore/policies?table=${encodeURIComponent(
												`${f.schema}.${f.table}`,
											)}`,
										)
									}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function FindingCard({
	finding,
	onViewPolicies,
}: {
	finding: SafetyFinding;
	onViewPolicies: () => void;
}) {
	const severityStyles = useMemo(() => {
		switch (finding.severity) {
			case "critical":
				return {
					dot: "bg-destructive",
					border: "border-l-destructive",
					icon: ShieldAlert,
				};
			case "warning":
				return {
					dot: "bg-warning",
					border: "border-l-warning",
					icon: ShieldAlert,
				};
			case "info":
				return {
					dot: "bg-primary",
					border: "border-l-primary",
					icon: ShieldCheck,
				};
		}
	}, [finding.severity]);

	const Icon = severityStyles.icon;

	return (
		<div
			className={cn(
				"rounded border border-border/70 border-l-4 bg-card px-3 py-2.5",
				severityStyles.border,
			)}
		>
			<div className="mb-1.5 flex items-center gap-2">
				<span className={cn("size-2 rounded-full", severityStyles.dot)} />
				<code className="font-mono text-xs">{finding.operation}</code>
			</div>
			<div className="mb-1 text-sm">{finding.message}</div>
			<div className="mb-2 text-muted-foreground text-xs leading-relaxed">
				{finding.detail}
			</div>

			{finding.affectedPolicies.length > 0 && (
				<div className="mb-2 flex flex-wrap gap-1.5">
					{finding.affectedPolicies.map((policy) => (
						<Badge
							key={policy}
							variant="secondary"
							className="font-mono text-[10px]"
						>
							policy:{policy}
						</Badge>
					))}
				</div>
			)}

			<div className="flex items-center gap-3 text-xs">
				<button
					type="button"
					onClick={onViewPolicies}
					className="text-muted-foreground transition-colors hover:text-foreground"
				>
					View policies →
				</button>
			</div>
		</div>
	);
}
