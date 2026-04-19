import {
	ChevronDown,
	ChevronRight,
	Loader2,
	Play,
	Search,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { MigrationCheckPanel } from "@/components/migration/MigrationCheckPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	AUDIT_SEVERITY_ORDER,
	type AuditFinding,
	type AuditResult,
	type AuditSeverity,
	formatRelativeTime,
	loadStoredAuditResults,
	saveStoredAuditResults,
} from "@/lib/audit";
import { cn } from "@/lib/utils";

type SeverityFilter = "all" | AuditSeverity;

function severityStyles(severity: AuditSeverity) {
	switch (severity) {
		case "critical":
			return {
				dot: "bg-destructive",
				text: "text-destructive",
				border: "border-l-destructive",
			};
		case "warning":
			return {
				dot: "bg-warning",
				text: "text-warning",
				border: "border-l-warning",
			};
		case "info":
			return {
				dot: "bg-primary",
				text: "text-primary",
				border: "border-l-primary",
			};
	}
}

interface TableGrouping {
	tableKey: string;
	findings: AuditFinding[];
	severityRank: number;
	hasCritical: boolean;
	hasWarning: boolean;
	hasInfo: boolean;
}

function gradeStyles(grade: "A" | "B" | "C" | "D" | "F") {
	switch (grade) {
		case "A":
		case "B":
			return {
				text: "text-green-400",
				bg: "bg-green-400/10",
				border: "border-green-400/20",
			};
		case "C":
			return {
				text: "text-amber-400",
				bg: "bg-amber-400/10",
				border: "border-amber-400/20",
			};
		case "D":
		case "F":
			return {
				text: "text-destructive",
				bg: "bg-destructive/10",
				border: "border-destructive/20",
			};
	}
}

export function AuditPage() {
	const navigate = useNavigate();
	const [result, setResult] = useState<AuditResult | null>(() =>
		loadStoredAuditResults(),
	);
	const [activeTab, setActiveTab] = useState<"overview" | "migration">(
		"overview",
	);
	const [search, setSearch] = useState("");
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
	const [now, setNow] = useState(Date.now());
	const [showUnprotected, setShowUnprotected] = useState(false);
	const {
		data: coverageData,
		isLoading: coverageLoading,
		error: coverageError,
	} = trpc.audit.coverage.useQuery();
	const auditMutation = trpc.audit.run.useMutation({
		onSuccess: (data) => {
			setResult(data);
			setExpandedTables(new Set());
			saveStoredAuditResults(data);
		},
	});

	useEffect(() => {
		const interval = window.setInterval(() => {
			setNow(Date.now());
		}, 60_000);

		return () => window.clearInterval(interval);
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const isModifier = event.metaKey || event.ctrlKey;
			if (isModifier && event.key === "Enter" && !auditMutation.isPending) {
				event.preventDefault();
				auditMutation.mutate();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [auditMutation]);

	const critical = useMemo(
		() => result?.findings.filter((f) => f.severity === "critical").length ?? 0,
		[result],
	);
	const warning = useMemo(
		() => result?.findings.filter((f) => f.severity === "warning").length ?? 0,
		[result],
	);
	const info = useMemo(
		() => result?.findings.filter((f) => f.severity === "info").length ?? 0,
		[result],
	);
	const tablesScanned = useMemo(
		() =>
			new Set(result?.findings.map((f) => `${f.schema}.${f.table}`) ?? []).size,
		[result],
	);

	const tableGroupings = useMemo((): TableGrouping[] => {
		if (!result) return [];

		const query = search.trim().toLowerCase();
		const grouped = new Map<string, AuditFinding[]>();

		for (const finding of result.findings) {
			const tableKey = `${finding.schema}.${finding.table}`;
			const existing = grouped.get(tableKey) ?? [];
			grouped.set(tableKey, [...existing, finding]);
		}

		const withCounts = Array.from(grouped.entries()).map(
			([tableKey, findings]) => {
				const c = findings.filter((f) => f.severity === "critical").length;
				const w = findings.filter((f) => f.severity === "warning").length;
				const i = findings.filter((f) => f.severity === "info").length;
				return {
					tableKey,
					findings,
					severityRank: c * 100 + w * 10 + i,
					hasCritical: c > 0,
					hasWarning: w > 0,
					hasInfo: i > 0,
				};
			},
		);

		return withCounts
			.filter(({ findings }) => {
				if (severityFilter === "all") return true;
				return findings.some((f) => f.severity === severityFilter);
			})
			.filter(({ tableKey, findings }) => {
				if (!query) return true;
				return (
					tableKey.toLowerCase().includes(query) ||
					findings.some(
						(f) =>
							f.check.toLowerCase().includes(query) ||
							`${f.schema}.${f.table}`.toLowerCase().includes(query),
					)
				);
			})
			.sort((a, b) => b.severityRank - a.severityRank);
	}, [result, search, severityFilter]);

	const runAudit = () => {
		auditMutation.reset();
		auditMutation.mutate();
	};

	if (auditMutation.error && !result) {
		return (
			<ApiErrorCard
				error={auditMutation.error}
				retry={runAudit}
				endpoint="/trpc/audit.run"
			/>
		);
	}

	if (activeTab === "migration") {
		return (
			<div className="flex h-full flex-col overflow-hidden px-4 pt-3 pb-4">
				<div className="mb-3 flex gap-1">
					<button
						type="button"
						onClick={() => setActiveTab("overview")}
						className={cn(
							"rounded px-2.5 py-1 font-medium text-xs transition-colors",
							activeTab === "overview"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
						)}
					>
						Overview
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("migration")}
						className={cn(
							"rounded px-2.5 py-1 font-medium text-xs transition-colors",
							activeTab === "migration"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
						)}
					>
						Migration Check
					</button>
				</div>
				<div className="flex-1 overflow-hidden">
					<MigrationCheckPanel mode="embedded" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-auto px-4 pt-3 pb-4">
			<div className="mb-3 flex gap-1">
				<button
					type="button"
					onClick={() => setActiveTab("overview")}
					className={cn(
						"rounded px-2.5 py-1 font-medium text-xs transition-colors",
						activeTab === "overview"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
					)}
				>
					Overview
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("migration")}
					className={cn(
						"rounded px-2.5 py-1 font-medium text-xs transition-colors",
						activeTab === "migration"
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
					)}
				>
					Migration Check
				</button>
			</div>

			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="font-semibold text-sm">Audit Overview</h1>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{result?.summary.ranAt ? (
							<>
								Last run: {formatRelativeTime(result.summary.ranAt, now)}
								{" · "}
								{critical === 0 && warning === 0 && info === 0 ? (
									<span className="text-green-400">No issues found</span>
								) : (
									<>
										<span className="text-destructive">
											{critical} critical
										</span>
										{" · "}
										<span className="text-warning">{warning} warning</span>
										{" · "}
										<span className="text-primary">{info} info</span>
										{" · "}
										{tablesScanned} tables scanned
									</>
								)}
							</>
						) : (
							<span className="text-muted-foreground text-xs">Never run</span>
						)}
					</p>
					{coverageError ? (
						<p className="mt-0.5 text-muted-foreground text-xs">
							Coverage: error: {coverageError.message}
						</p>
					) : coverageLoading ? (
						<p className="mt-0.5 text-muted-foreground text-xs">
							Coverage: loading...
						</p>
					) : coverageData ? (
						<>
							<p className="mt-0.5 text-muted-foreground text-xs">
								<span className="text-muted-foreground">Coverage: </span>
								<span
									className={cn(
										"font-medium",
										gradeStyles(coverageData.grade).text,
									)}
								>
									{coverageData.score}%
								</span>
								<span
									className={cn(
										"ml-1 rounded px-1 font-bold text-xs",
										gradeStyles(coverageData.grade).bg,
										gradeStyles(coverageData.grade).text,
									)}
								>
									{coverageData.grade}
								</span>
								{" · "}
								<span className="text-muted-foreground">
									{coverageData.withPoliciesCount} of {coverageData.totalTables}{" "}
									tables protected
								</span>
								{" · "}
								<span
									className={cn(
										coverageData.unprotectedTables.length > 0
											? "text-destructive"
											: "text-green-400",
									)}
								>
									{coverageData.unprotectedTables.length} unprotected
								</span>
								{coverageData.unprotectedTables.length > 0 && (
									<button
										type="button"
										onClick={() => setShowUnprotected(!showUnprotected)}
										className="ml-2 text-muted-foreground underline"
									>
										{showUnprotected ? "▼" : "▶"} Show unprotected tables (
										{coverageData.unprotectedTables.length})
									</button>
								)}
							</p>
							{showUnprotected && coverageData.unprotectedTables.length > 0 && (
								<div className="mt-1 flex flex-wrap gap-1">
									{coverageData.unprotectedTables.slice(0, 20).map((t) => (
										<button
											key={`${t.schema}.${t.table}`}
											type="button"
											onClick={() =>
												navigate(
													`/explore/policies?table=${encodeURIComponent(
														`${t.schema}.${t.table}`,
													)}`,
												)
											}
											className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
										>
											{t.schema}.{t.table}
										</button>
									))}
									{coverageData.unprotectedTables.length > 20 && (
										<span className="text-[10px] text-muted-foreground">
											+ {coverageData.unprotectedTables.length - 20} more
										</span>
									)}
								</div>
							)}
						</>
					) : null}
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link to="/audit/ci">CI Mode →</Link>
					</Button>
					<Button
						size="sm"
						onClick={runAudit}
						disabled={auditMutation.isPending}
						className="bg-success text-success-foreground hover:bg-success/90"
					>
						{auditMutation.isPending ? (
							<>
								<Loader2 className="size-3.5 animate-spin" />
								Scanning...
							</>
						) : (
							<>
								<Play className="size-3.5" />
								Run Audit
							</>
						)}
					</Button>
				</div>
			</div>

			{auditMutation.isPending && (
				<div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-3 text-sm">
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
					<span>Scanning your database...</span>
				</div>
			)}

			{auditMutation.error && result && (
				<div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3 text-destructive text-sm">
					{auditMutation.error.message}
				</div>
			)}

			{!result && !auditMutation.isPending && !auditMutation.error && (
				<div className="mt-4 flex flex-1 items-center justify-center">
					<p className="text-muted-foreground text-xs">
						Run an audit to scan your RLS configuration
					</p>
				</div>
			)}

			{result && (
				<>
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<div className="relative min-w-[220px] max-w-sm flex-1">
							<Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search by table or check..."
								className="h-8 pl-8 text-xs"
							/>
						</div>
						{(["all", ...AUDIT_SEVERITY_ORDER] as const).map((option) => (
							<button
								key={option}
								type="button"
								onClick={() => setSeverityFilter(option)}
								className={cn(
									"rounded-md border px-2.5 py-1 font-medium text-[11px] transition-colors",
									severityFilter === option
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:bg-muted",
								)}
							>
								{option === "all"
									? "All"
									: option.charAt(0).toUpperCase() + option.slice(1)}
							</button>
						))}
					</div>

					{tableGroupings.length === 0 ? (
						<div className="mt-4 rounded-lg border border-border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
							No findings match the current filters.
						</div>
					) : (
						<div className="mt-3 space-y-1">
							{tableGroupings.map(({ tableKey, findings }) => (
								<TableFindingsRow
									key={tableKey}
									tableKey={tableKey}
									findings={findings}
									expanded={expandedTables.has(tableKey)}
									onToggle={() =>
										setExpandedTables((prev) => {
											const next = new Set(prev);
											if (next.has(tableKey)) {
												next.delete(tableKey);
											} else {
												next.add(tableKey);
											}
											return next;
										})
									}
									onViewPolicies={(table) =>
										navigate(
											`/explore/policies?table=${encodeURIComponent(table)}`,
										)
									}
									onSimulate={(table) =>
										navigate(`/simulate?table=${encodeURIComponent(table)}`)
									}
								/>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}

function TableFindingsRow({
	tableKey,
	findings,
	expanded,
	onToggle,
	onViewPolicies,
	onSimulate,
}: {
	tableKey: string;
	findings: AuditFinding[];
	expanded: boolean;
	onToggle: () => void;
	onViewPolicies: (table: string) => void;
	onSimulate: (table: string) => void;
}) {
	const severities = useMemo(() => {
		const s = new Set(findings.map((f) => f.severity));
		return Array.from(s);
	}, [findings]);

	const visibleSeverities = severities.slice(0, 4);
	const extraCount = severities.length - 4;

	return (
		<div className="overflow-hidden rounded border border-border/70 bg-card">
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5",
				)}
			>
				{expanded ? (
					<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
				)}
				<code className="shrink-0 font-mono text-sm">{tableKey}</code>
				<div className="flex shrink-0 items-center gap-1.5">
					{visibleSeverities.map((sev) => {
						const styles = severityStyles(sev);
						return (
							<span
								key={sev}
								className={cn("size-2 rounded-full", styles.dot)}
							/>
						);
					})}
					{extraCount > 0 && (
						<span className="text-muted-foreground text-xs">
							+{extraCount} more
						</span>
					)}
				</div>
				<span className="ml-auto shrink-0 text-muted-foreground text-xs">
					{findings.length} issue{findings.length !== 1 ? "s" : ""}
				</span>
			</button>

			<div
				className={cn(
					"grid transition-all duration-150 ease-out",
					expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<div className="space-y-2 px-4 pt-1 pb-4">
						{findings.map((finding) => {
							const styles = severityStyles(finding.severity);
							return (
								<div
									key={finding.id}
									className={cn(
										"rounded border border-border/70 border-l-4 bg-background/60 px-3 py-2.5",
										styles.border,
									)}
								>
									<div className="mb-1.5 flex items-center gap-2">
										<span className={cn("size-2 rounded-full", styles.dot)} />
										<code className={cn("font-mono text-xs", styles.text)}>
											{finding.check}
										</code>
									</div>
									<div className="mb-1 text-sm">{finding.message}</div>
									<div className="mb-2 text-muted-foreground text-xs leading-relaxed">
										{finding.detail}
									</div>

									{((finding.affectedRoles?.length ?? 0) > 0 ||
										(finding.affectedPolicies?.length ?? 0) > 0) && (
										<div className="mb-2 flex flex-wrap gap-1.5">
											{finding.affectedRoles?.map((role) => (
												<Badge
													key={`${finding.id}:${role}`}
													variant="outline"
													className="font-mono text-[10px]"
												>
													role:{role}
												</Badge>
											))}
											{finding.affectedPolicies?.map((policy) => (
												<Badge
													key={`${finding.id}:${policy}`}
													variant="secondary"
													className="font-mono text-[10px]"
												>
													policy:{policy}
												</Badge>
											))}
										</div>
									)}

									<div className="flex flex-wrap items-center gap-3 text-xs">
										<button
											type="button"
											onClick={() => onViewPolicies(tableKey)}
											className="text-muted-foreground transition-colors hover:text-foreground"
										>
											View policies →
										</button>
										<button
											type="button"
											onClick={() => onSimulate(tableKey)}
											className="text-muted-foreground transition-colors hover:text-foreground"
										>
											Simulate →
										</button>
										<button
											type="button"
											disabled
											className="inline-flex items-center gap-2 text-muted-foreground/60"
										>
											<Sparkles className="size-3" />
											Explain with AI
											<Badge variant="outline" className="text-[10px]">
												coming soon
											</Badge>
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
