import {
	ChevronDown,
	ChevronRight,
	Loader2,
	Play,
	Search,
	Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { MigrationCheckPanel } from "@/components/migration/MigrationCheckPanel";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAiAvailable } from "@/hooks/use-ai-available";
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

interface CheckGrouping {
	check: string;
	severity: AuditSeverity;
	tables: AuditFinding[];
	severityRank: number;
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
	const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
	const [now, setNow] = useState(Date.now());
	const [showUnprotected, setShowUnprotected] = useState(false);
	const [summary, setSummary] = useState<string | null>(null);
	const [summaryLoading, setSummaryLoading] = useState(false);
	const [summaryError, setSummaryError] = useState<string | null>(null);

	const {
		data: coverageData,
		isLoading: coverageLoading,
		error: coverageError,
	} = trpc.audit.coverage.useQuery();
	const auditMutation = trpc.audit.run.useMutation({
		onSuccess: (data) => {
			setResult(data);
			setExpandedChecks(new Set());
			saveStoredAuditResults(data);
			setSummary(null);
		},
	});
	const summarizeMutation = trpc.ai.summarize.useMutation();

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

	const checkGroupings = useMemo((): CheckGrouping[] => {
		if (!result) return [];

		const query = search.trim().toLowerCase();

		const grouped = result.findings.reduce(
			(acc, finding) => {
				if (!acc[finding.check]) {
					acc[finding.check] = {
						check: finding.check,
						severity: finding.severity,
						tables: [],
					};
				}
				acc[finding.check].tables.push(finding);
				return acc;
			},
			{} as Record<
				string,
				{ check: string; severity: AuditSeverity; tables: AuditFinding[] }
			>,
		);

		const withSeverityRank = Array.from(Object.values(grouped)).map((g) => {
			const severities = new Set(g.tables.map((f) => f.severity));
			const rankMap: Record<AuditSeverity, number> = {
				critical: 300,
				warning: 200,
				info: 100,
			};
			const severityRank = Math.max(
				...Array.from(severities).map((s) => rankMap[s]),
			);
			return {
				check: g.check,
				severity: g.severity,
				tables: g.tables,
				severityRank,
			};
		});

		const filtered = withSeverityRank
			.filter(({ tables }) => {
				if (severityFilter === "all") return true;
				return tables.some((f) => f.severity === severityFilter);
			})
			.filter(({ check, tables }) => {
				if (!query) return true;
				if (check.toLowerCase().includes(query)) return true;
				return tables.some((f) =>
					`${f.schema}.${f.table}`.toLowerCase().includes(query),
				);
			});

		const sorted = filtered.sort((a, b) => b.severityRank - a.severityRank);

		return sorted.map((group) => ({
			...group,
			tables: group.tables.slice().sort((a, b) => {
				const tableA = `${a.schema}.${a.table}`.toLowerCase();
				const tableB = `${b.schema}.${b.table}`.toLowerCase();
				return tableA.localeCompare(tableB);
			}),
		}));
	}, [result, search, severityFilter]);

	const uniqueChecks = useMemo(
		() => new Set(result?.findings.map((f) => f.check) ?? []).size,
		[result],
	);

	const runAudit = () => {
		auditMutation.reset();
		auditMutation.mutate();
	};

	const { available: aiAvailable, openSettings } = useAiAvailable();

	const handleSummarize = async () => {
		if (!result) return;
		setSummaryLoading(true);
		setSummaryError(null);
		try {
			const res = await summarizeMutation.mutateAsync({
				findings: result.findings.map((f) => ({
					check: f.check,
					severity: f.severity,
					table: f.table,
					message: f.message,
				})),
			});
			if ("error" in res && res.error) {
				setSummaryError(
					(res as { message?: string }).message ?? "AI summary failed",
				);
			} else if ("summary" in res) {
				setSummary(res.summary);
			}
		} catch (e) {
			setSummaryError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setSummaryLoading(false);
		}
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
				<div className="mb-6 flex gap-0 border-[#222222] border-b">
					<button
						type="button"
						onClick={() => setActiveTab("overview")}
						className={cn(
							"-mb-[2px] cursor-pointer border-b-2 px-4 py-2 font-mono text-xs transition-colors",
							activeTab === "overview"
								? "border-accent text-accent"
								: "border-transparent text-[#666666] hover:text-[#999999]",
						)}
					>
						Overview
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("migration")}
						className={cn(
							"-mb-[2px] cursor-pointer border-b-2 px-4 py-2 font-mono text-xs transition-colors",
							activeTab === "migration"
								? "border-accent text-accent"
								: "border-transparent text-[#666666] hover:text-[#999999]",
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
			<div className="mb-6 flex gap-0 border-[#222222] border-b">
				<button
					type="button"
					onClick={() => setActiveTab("overview")}
					className={cn(
						"-mb-[2px] cursor-pointer border-b-2 px-4 py-2 font-mono text-xs transition-colors",
						activeTab === "overview"
							? "border-accent text-accent"
							: "border-transparent text-[#666666] hover:text-[#999999]",
					)}
				>
					Overview
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("migration")}
					className={cn(
						"-mb-[2px] cursor-pointer border-b-2 px-4 py-2 font-mono text-xs transition-colors",
						activeTab === "migration"
							? "border-accent text-accent"
							: "border-transparent text-[#666666] hover:text-[#999999]",
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
											{uniqueChecks} checks flagged
										</span>
										{" · "}
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
					{result && (
						<div className="mt-3 flex flex-wrap items-center gap-2">
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
					)}
				</div>

				{/* Right side */}
				<div className="flex shrink-0 items-center gap-3">
					<Link
						to="/audit/ci"
						className="flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
					>
						<Terminal className="size-3.5" />
						<span className="font-medium">CI/CD</span>
					</Link>

					{result && aiAvailable && (
						<button
							type="button"
							onClick={handleSummarize}
							disabled={summaryLoading}
							className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700/90 px-3 py-1.5 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
						>
							{summaryLoading ? (
								<Loader2 className="size-3 animate-spin text-emerald-100" />
							) : null}
							<span className="font-mono font-semibold text-[11px] text-emerald-50">
								{summaryLoading
									? "Generating..."
									: summaryError
										? "Retry AI summary"
										: summary
											? "Regenerate AI summary"
											: "Generate AI summary"}
							</span>
						</button>
					)}

					<button
						type="button"
						onClick={runAudit}
						disabled={auditMutation.isPending}
						className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700/90 px-3 py-1.5 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
					>
						{auditMutation.isPending ? (
							<Loader2 className="size-3 animate-spin text-emerald-100" />
						) : (
							<Play className="size-3 text-emerald-100" />
						)}
						<span className="font-mono font-semibold text-[11px] text-emerald-50">
							{auditMutation.isPending ? "Scanning..." : "Run Audit"}
						</span>
					</button>
				</div>
			</div>

			{result && (
				<div className="mt-2">
					{!aiAvailable ? (
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-xs">
								Add an AI provider in Settings to use AI features
							</span>
							<button
								type="button"
								onClick={openSettings}
								className="font-mono text-[11px] text-accent hover:underline"
							>
								Open Settings →
							</button>
						</div>
					) : summaryLoading ? (
						<div className="flex animate-pulse items-center gap-2 font-mono text-[11px] text-accent opacity-50">
							✦ Generating summary...
						</div>
					) : summaryError ? (
						<div className="space-y-1">
							<div className="text-destructive text-xs">{summaryError}</div>
							<button
								type="button"
								onClick={handleSummarize}
								className="font-mono text-[11px] text-accent hover:underline"
							>
								↻ Retry
							</button>
						</div>
					) : summary ? (
						<div className="space-y-1 rounded border border-border/70 bg-card p-3">
							<div className="font-mono text-[#666666] text-[10px] uppercase tracking-widest">
								AI Summary
							</div>
							<div className="font-sans text-[#cccccc] text-xs">{summary}</div>
							<button
								type="button"
								onClick={handleSummarize}
								className="font-mono text-[11px] text-accent hover:underline"
							>
								↻ Regenerate
							</button>
						</div>
					) : null}
				</div>
			)}

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
					{checkGroupings.length === 0 ? (
						<div className="mt-4 rounded-lg border border-border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
							No findings match the current filters.
						</div>
					) : (
						<div className="mt-3 space-y-1">
							{checkGroupings.map(({ check, severity, tables }) => (
								<CheckFindingsRow
									key={check}
									check={check}
									severity={severity}
									tables={tables}
									expanded={expandedChecks.has(check)}
									onToggle={() =>
										setExpandedChecks((prev) => {
											const next = new Set(prev);
											if (next.has(check)) {
												next.delete(check);
											} else {
												next.add(check);
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

function CheckFindingsRow({
	check,
	severity,
	tables,
	expanded,
	onToggle,
	onViewPolicies,
	onSimulate,
}: {
	check: string;
	severity: AuditSeverity;
	tables: AuditFinding[];
	expanded: boolean;
	onToggle: () => void;
	onViewPolicies: (table: string) => void;
	onSimulate: (table: string) => void;
}) {
	const { available: aiAvailable, openSettings } = useAiAvailable();
	const styles = severityStyles(severity);
	const tableCount = tables.length;

	const sampleMessage = tables[0]?.message ?? "";
	const sampleDetail = tables[0]?.detail ?? "";

	const [explainCache, setExplainCache] = useState<Record<string, string>>({});
	const [explainLoading, setExplainLoading] = useState(false);
	const [explainError, setExplainError] = useState<string | null>(null);
	const explainMutation = trpc.ai.explain.useMutation();

	const [suggestExpanded, setSuggestExpanded] = useState(false);
	const [suggestInput, setSuggestInput] = useState("");
	const [suggestLoading, setSuggestLoading] = useState(false);
	const [suggestError, setSuggestError] = useState<string | null>(null);
	const [suggestResult, setSuggestResult] = useState<{
		policyName: string;
		sql: string;
		explanation: string;
	} | null>(null);
	const [copied, setCopied] = useState(false);
	const suggestMutation = trpc.ai.suggest.useMutation();

	const firstTable = tables[0];
	const explainCacheKey = `${check}:${firstTable?.table ?? ""}`;

	const handleExplain = async () => {
		if (!firstTable) return;
		setExplainLoading(true);
		setExplainError(null);
		try {
			const res = await explainMutation.mutateAsync({
				policyName: check,
				schema: firstTable.schema,
				table: firstTable.table,
				cmd: severity,
				permissive: "permissive",
				roles: firstTable.affectedRoles ?? [],
				using: firstTable.message,
				withCheck: null,
			});
			if ("error" in res && res.error) {
				setExplainError(
					(res as { message?: string }).message ?? "AI explanation failed",
				);
			} else if ("explanation" in res) {
				setExplainCache((prev) => ({
					...prev,
					[explainCacheKey]: res.explanation,
				}));
			}
		} catch (e) {
			setExplainError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setExplainLoading(false);
		}
	};

	const handleSuggest = async () => {
		if (!firstTable) return;
		setSuggestLoading(true);
		setSuggestError(null);
		try {
			const res = await suggestMutation.mutateAsync({
				schema: firstTable.schema,
				table: firstTable.table,
				intent: suggestInput,
			});
			if ("error" in res && res.error) {
				setSuggestError(
					(res as { message?: string }).message ?? "AI suggestion failed",
				);
			} else if ("policy" in res && res.policy) {
				setSuggestResult({
					policyName: res.policy.policyName,
					sql: res.policy.sql,
					explanation: res.policy.explanation,
				});
			}
		} catch (e) {
			setSuggestError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setSuggestLoading(false);
		}
	};

	const handleCopySql = async () => {
		if (!suggestResult) return;
		await navigator.clipboard.writeText(suggestResult.sql);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	const cachedExplanation = explainCache[explainCacheKey];

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
				<code
					className="shrink-0 font-mono text-xs"
					style={{
						color:
							severity === "critical"
								? "#ff4444"
								: severity === "warning"
									? "#ffaa00"
									: "#4499ff",
					}}
				>
					{check}
				</code>
				<span className="shrink-0 text-[10px] text-muted-foreground">
					{tableCount} table{tableCount !== 1 ? "s" : ""} affected
				</span>
				<span
					className={cn(
						"ml-auto flex shrink-0 items-center gap-1.5",
						styles.text,
					)}
				>
					<span className={cn("size-2 rounded-full", styles.dot)} />
					<span className="font-medium text-xs capitalize">{severity}</span>
				</span>
			</button>

			<div
				className={cn(
					"grid transition-all duration-150 ease-out",
					expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
				)}
			>
				<div className="overflow-hidden">
					<div className="border-border/50 border-t px-4 pt-3 pb-3">
						<div className="mb-1 text-sm">{sampleMessage}</div>
						<div className="mb-3 text-muted-foreground text-xs leading-relaxed">
							{sampleDetail}
						</div>
						<div className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
							AFFECTED TABLES:
						</div>
						<div className="space-y-1">
							{tables.map((finding) => {
								const tableKey = `${finding.schema}.${finding.table}`;
								return (
									<div
										key={finding.id}
										className="flex flex-wrap items-center gap-x-2 gap-y-1"
									>
										<code className="font-mono text-xs">
											{finding.schema}.{finding.table}
										</code>
										{(finding.affectedPolicies?.length ?? 0) > 0 && (
											<div className="flex flex-wrap gap-1">
												{finding.affectedPolicies?.map((policy) => (
													<Badge
														key={`${finding.id}:${policy}`}
														variant="secondary"
														className="font-mono text-[10px]"
													>
														{policy}
													</Badge>
												))}
											</div>
										)}
										<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
											<button
												type="button"
												onClick={() => onViewPolicies(tableKey)}
												className="transition-colors hover:text-accent"
											>
												View policies →
											</button>
											<button
												type="button"
												onClick={() => onSimulate(tableKey)}
												className="transition-colors hover:text-accent"
											>
												Simulate →
											</button>
										</div>
									</div>
								);
							})}
						</div>
						<div className="mt-3 space-y-2">
							{explainLoading ? (
								<div className="flex animate-pulse items-center gap-2 font-mono text-[11px] text-accent opacity-50">
									✦ Explaining...
								</div>
							) : explainError && !cachedExplanation ? (
								<div className="space-y-1">
									<div className="text-destructive text-xs">{explainError}</div>
									<button
										type="button"
										onClick={handleExplain}
										className="font-mono text-[11px] text-accent hover:underline"
									>
										↻ Retry
									</button>
								</div>
							) : cachedExplanation ? (
								<div className="space-y-1">
									<div className="font-sans text-[#cccccc] text-xs">
										{cachedExplanation}
									</div>
									<button
										type="button"
										onClick={handleExplain}
										className="font-mono text-[11px] text-accent hover:underline"
									>
										↻ Re-explain
									</button>
								</div>
							) : !aiAvailable ? (
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">
										Add an AI provider in Settings to use AI features
									</span>
									<button
										type="button"
										onClick={openSettings}
										className="font-mono text-[11px] text-accent hover:underline"
									>
										Open Settings →
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={handleExplain}
									className="rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:border-accent hover:text-accent"
								>
									✦ Explain with AI
								</button>
							)}
						</div>

						{check === "missing_rls" && (
							<div className="mt-2">
								{!suggestExpanded ? (
									<button
										type="button"
										onClick={() => setSuggestExpanded(true)}
										className="rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:border-accent hover:text-accent"
									>
										✦ Suggest policy →
									</button>
								) : (
									<div className="space-y-2 rounded border border-border/70 bg-card p-3">
										{suggestLoading ? (
											<div className="animate-pulse font-mono text-[11px] text-accent opacity-50">
												✦ Generating...
											</div>
										) : suggestError && !suggestResult ? (
											<div className="space-y-1">
												<div className="text-destructive text-xs">
													{suggestError}
												</div>
												<button
													type="button"
													onClick={handleSuggest}
													className="font-mono text-[11px] text-accent hover:underline"
												>
													↻ Retry
												</button>
											</div>
										) : suggestResult ? (
											<div className="space-y-2">
												<div className="font-mono text-accent text-xs">
													{suggestResult.policyName}
												</div>
												<pre className="overflow-x-auto rounded border border-border bg-[#0a0a0a] p-2 font-mono text-[11px] leading-relaxed">
													<code>{suggestResult.sql}</code>
												</pre>
												<div className="font-sans text-[#cccccc] text-xs">
													{suggestResult.explanation}
												</div>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={handleCopySql}
														className="rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:border-accent hover:text-accent"
													>
														{copied ? "✓ Copied" : "Copy SQL"}
													</button>
													<button
														type="button"
														onClick={() => {
															setSuggestResult(null);
															setSuggestInput("");
														}}
														className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
													>
														Close
													</button>
												</div>
											</div>
										) : (
											<>
												<textarea
													value={suggestInput}
													onChange={(e) => setSuggestInput(e.target.value)}
													placeholder="Users should only see their own records..."
													rows={3}
													className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
												/>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={handleSuggest}
														disabled={!suggestInput.trim()}
														className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
													>
														Generate →
													</button>
													<button
														type="button"
														onClick={() => setSuggestExpanded(false)}
														className="rounded px-3 py-1 text-muted-foreground text-xs hover:text-foreground"
													>
														Cancel
													</button>
												</div>
											</>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
