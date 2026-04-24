import {
	AlertTriangle,
	Check,
	Play,
	Plus,
	Shield,
	Table2,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rlsmon:simulate:v2-config";

type Scope = "table" | "row";

interface JwtClaim {
	key: string;
	value: string;
}

interface SimulateConfig {
	scope: Scope;
	role: string;
	table: string;
	claims: JwtClaim[];
	rowId: string;
}

function loadConfig(): SimulateConfig {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed.scope && parsed.role && parsed.table) {
				return {
					scope: parsed.scope || "table",
					role: parsed.role || "",
					table: parsed.table || "",
					claims: parsed.claims || [{ key: "", value: "" }],
					rowId: parsed.rowId || "",
				};
			}
		}
	} catch {
		// Ignore
	}
	return {
		scope: "table",
		role: "",
		table: "",
		claims: [{ key: "", value: "" }],
		rowId: "",
	};
}

function saveConfig(config: SimulateConfig): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// localStorage unavailable
	}
}

function ScopeToggle({
	scope,
	onChange,
}: {
	scope: Scope;
	onChange: (scope: Scope) => void;
}) {
	return (
		<div className="flex rounded-lg border border-input bg-background p-0.5">
			<button
				type="button"
				onClick={() => onChange("table")}
				className={cn(
					"flex-1 rounded-md py-1.5 font-medium text-xs transition-colors",
					scope === "table"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Table2 className="h-3.5 w-3.5" />
					Table
				</div>
			</button>
			<button
				type="button"
				onClick={() => onChange("row")}
				className={cn(
					"flex-1 rounded-md py-1.5 font-medium text-xs transition-colors",
					scope === "row"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Shield className="h-3.5 w-3.5" />
					Row
				</div>
			</button>
		</div>
	);
}

function formatCellValue(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function SimulatePage() {
	const [config, setConfig] = useState<SimulateConfig>(loadConfig);
	const [selectedRowData, setSelectedRowData] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [results, setResults] = useState<unknown>(null);
	const [isRunning, setIsRunning] = useState(false);

	const [schema, tableName] = config.table ? config.table.split(".") : ["", ""];

	const rolesQuery = trpc.roles.list.useQuery();
	const metaQuery = trpc.meta.get.useQuery();
	const rowAccessQuery = trpc.rowAccess.getRows.useQuery(
		{ schema: schema || "", table: tableName || "" },
		{ enabled: !!schema && !!tableName },
	);
	const simulateMutation = trpc.simulate.select.useMutation();
	const rowAccessMutation = trpc.rowAccess.checkAccess.useMutation();

	const tables = useMemo(
		() =>
			metaQuery.data?.tables.map((t) => `${t.schema}.${t.name}`).sort() ?? [],
		[metaQuery.data],
	);
	const roles = useMemo(
		() => rolesQuery.data?.map((r) => r.name).sort() ?? [],
		[rolesQuery.data],
	);

	const primaryKeys = rowAccessQuery.data?.primaryKeys ?? [];
	const rowColumns = rowAccessQuery.data?.columns ?? [];
	const tableRows = rowAccessQuery.data?.rows ?? [];

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isModifier = e.metaKey || e.ctrlKey;
			if (isModifier && e.key === "Enter") {
				e.preventDefault();
				handleRun();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	useEffect(() => {
		saveConfig(config);
	}, [config]);

	useEffect(() => {
		setResults(null);
	}, [config.role, config.table, config.scope]);

	const claimsObject = useMemo(() => {
		const obj: Record<string, unknown> = {};
		for (const claim of config.claims) {
			if (claim.key) {
				obj[claim.key] = claim.value;
			}
		}
		return obj;
	}, [config.claims]);

	const canRun = useMemo(() => {
		if (!config.role || !config.table) return false;
		if (config.scope === "row" && !selectedRowData) return false;
		return true;
	}, [config.role, config.table, config.scope, selectedRowData]);

	const handleRun = async () => {
		if (!canRun) return;
		setIsRunning(true);
		setResults(null);

		try {
			if (config.scope === "table") {
				const result = await simulateMutation.mutateAsync({
					schema: schema,
					table: tableName,
					role: config.role,
					jwtClaims: claimsObject,
				});
				setResults({ type: "table", data: result });
			} else {
				const pkValues: Record<string, unknown> = {};
				for (const pk of primaryKeys) {
					const val = selectedRowData?.[pk];
					if (val !== undefined) {
						pkValues[pk] = val;
					}
				}
				const result = await rowAccessMutation.mutateAsync({
					schema: schema,
					table: tableName,
					pkValues,
					jwtClaims: claimsObject,
					role: config.role,
				});
				setResults({ type: "row", data: result });
			}
		} catch (e) {
			setResults({ type: "error", error: (e as Error).message });
		} finally {
			setIsRunning(false);
		}
	};

	const handleSelectRow = (row: Record<string, unknown>) => {
		setSelectedRowData(row);
		const pkValues: Record<string, unknown> = {};
		for (const pk of primaryKeys) {
			const val = row[pk];
			if (val !== undefined) {
				pkValues[pk] = val;
			}
		}
		const rowIdStr = Object.entries(pkValues)
			.map(([k, v]) => `${k}=${v}`)
			.join(",");
		setConfig({ ...config, rowId: rowIdStr });
	};

	const updateConfig = (updates: Partial<SimulateConfig>) => {
		setConfig((prev) => ({ ...prev, ...updates }));
		setResults(null);
	};

	const tableResults =
		(results as { type?: string; data?: unknown })?.type === "table"
			? (
					results as {
						type?: string;
						data?: { columns?: string[]; rows?: Record<string, unknown>[] };
					}
				).data
			: null;
	const rowResults =
		(results as { type?: string; data?: unknown })?.type === "row"
			? (
					results as {
						type?: string;
						data?: {
							allowed?: boolean;
							appliedPolicies?: string[];
							rowSnapshot?: Record<string, unknown>;
						};
					}
				).data
			: null;

	return (
		<div className="flex h-full">
			<div className="flex w-[320px] shrink-0 flex-col border-input border-r bg-card">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<h1 className="font-semibold text-sm">Simulate</h1>
					<p className="text-[11px] text-muted-foreground">
						Test RLS policies with role + claims
					</p>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="flex-1 overflow-y-auto px-3">
						<div className="space-y-3">
							<div className="space-y-2">
								<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Scope
								</span>
								<ScopeToggle
									scope={config.scope}
									onChange={(scope) => updateConfig({ scope })}
								/>
							</div>

							<div className="flex">
								<div className="flex-1 space-y-2">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Role
									</span>
									<Select
										value={config.role}
										onValueChange={(value) => updateConfig({ role: value })}
									>
										<SelectTrigger className="h-8">
											<SelectValue placeholder="Select role" />
										</SelectTrigger>
										<SelectContent>
											{roles.map((role) => (
												<SelectItem key={role} value={role}>
													{role}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex-1 space-y-2">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Table
									</span>
									<Select
										value={config.table}
										onValueChange={(value) =>
											updateConfig({ table: value, rowId: "" })
										}
									>
										<SelectTrigger className="h-8">
											<SelectValue placeholder="Select table" />
										</SelectTrigger>
										<SelectContent>
											{tables.map((t) => (
												<SelectItem key={t} value={t}>
													{t}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<span className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									JWT Claims{" "}
									<span className="text-[9px] normal-case">(optional)</span>
								</span>
								<div className="space-y-2">
									{config.claims.map((claim, index) => (
										<div key={index} className="flex items-center gap-1">
											<input
												type="text"
												value={claim.key}
												onChange={(e) => {
													const updated = [...config.claims];
													updated[index].key = e.target.value;
													updateConfig({ claims: updated });
												}}
												placeholder="key"
												className="h-7 w-[35%] rounded-l border border-input bg-background px-2 font-mono text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
											/>
											<input
												type="text"
												value={claim.value}
												onChange={(e) => {
													const updated = [...config.claims];
													updated[index].value = e.target.value;
													updateConfig({ claims: updated });
												}}
												placeholder="value"
												className="h-7 w-[65%] rounded-r border border-input bg-background px-2 font-mono text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
											/>
											<button
												type="button"
												onClick={() => {
													const updated = config.claims.filter(
														(_, i) => i !== index,
													);
													updateConfig({ claims: updated });
												}}
												className="flex h-7 w-7 items-center justify-center rounded border border-input text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
											>
												<Trash2 className="size-3" />
											</button>
										</div>
									))}
									<button
										type="button"
										onClick={() => {
											updateConfig({
												claims: [...config.claims, { key: "", value: "" }],
											});
										}}
										className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
									>
										<Plus className="size-3" />
										Add Claim
									</button>
								</div>
							</div>

							{config.scope === "row" && config.table && (
								<div className="space-y-2">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Row
									</span>
									<Select
										value={config.rowId}
										onValueChange={(value) => {
											const row = tableRows.find((r) => {
												const pkVals = primaryKeys
													.map((pk) => `${pk}=${r[pk]}`)
													.join(",");
												return pkVals === value;
											});
											if (row) handleSelectRow(row);
										}}
									>
										<SelectTrigger className="h-8">
											<SelectValue placeholder="Select row" />
										</SelectTrigger>
										<SelectContent>
											{tableRows.map((row, idx) => {
												const pkVals = primaryKeys
													.map((pk) => `${pk}=${row[pk]}`)
													.join(",");
												return (
													<SelectItem key={idx} value={pkVals}>
														{pkVals}
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
								</div>
							)}

							{config.scope === "row" && config.table && selectedRowData && (
								<div className="space-y-2">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Row Preview
									</span>
									<pre className="max-h-[80px] overflow-auto rounded-md border border-input bg-background p-2 font-mono text-[10px] text-foreground">
										{JSON.stringify(
											rowColumns.slice(0, 4).reduce(
												(acc, col) => {
													if (selectedRowData[col] !== undefined) {
														acc[col] = selectedRowData[col];
													}
													return acc;
												},
												{} as Record<string, unknown>,
											),
											null,
											2,
										)}
									</pre>
								</div>
							)}

							<div className="pt-2">
								<Button
									onClick={handleRun}
									disabled={!canRun || isRunning}
									className="w-full"
								>
									{isRunning ? (
										<span className="flex items-center gap-2">Running...</span>
									) : (
										<span className="flex items-center gap-2">
											<Play className="h-3.5 w-3.5" />
											Run Simulation
										</span>
									)}
								</Button>
								<p className="mt-1 text-center text-[10px] text-muted-foreground">
									Cmd + Enter
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden">
				{!results && (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<div className="text-center">
							<Play className="mx-auto h-8 w-8 opacity-50" />
							<p className="mt-2 text-sm">Run simulation to see results</p>
						</div>
					</div>
				)}

				{(results as { type?: string; error?: string })?.type === "error" && (
					<div className="flex-1 overflow-auto p-4">
						<ApiErrorCard
							error={{
								message:
									(results as { error?: string }).error || "Unknown error",
							}}
						/>
					</div>
				)}

				{config.scope === "table" && tableResults && (
					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="border-input border-b px-4 py-2">
							<span className="font-medium text-foreground text-sm">
								Visible rows: {tableResults.rows?.length ?? 0}
							</span>
						</div>
						<div className="flex-1 overflow-auto">
							{tableResults.rows?.length === 0 ? (
								<div className="flex h-full items-center justify-center text-muted-foreground">
									<div className="text-center">
										<AlertTriangle className="mx-auto h-6 w-6 opacity-50" />
										<p className="mt-2 text-sm">
											No rows visible under current policies
										</p>
									</div>
								</div>
							) : (
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 bg-background">
										<tr>
											{tableResults.columns?.map((col: string) => (
												<th
													key={col}
													className="border-input border-b px-3 py-2 font-medium text-muted-foreground"
												>
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{tableResults.rows?.map(
											(row: Record<string, unknown>, idx: number) => (
												<tr
													key={idx}
													className="border-input border-b hover:bg-accent"
												>
													{tableResults.columns?.map((col: string) => (
														<td
															key={col}
															className="max-w-[200px] truncate px-3 py-2 font-mono text-foreground"
														>
															{formatCellValue(row[col])}
														</td>
													))}
												</tr>
											),
										)}
									</tbody>
								</table>
							)}
						</div>
					</div>
				)}

				{config.scope === "row" && rowResults && (
					<div className="flex flex-1 flex-col overflow-auto p-4">
						<div
							className={cn(
								"flex items-center gap-2 rounded-lg border p-4",
								rowResults.allowed
									? "border-green-500/50 bg-green-500/10"
									: "border-red-500/50 bg-red-500/10",
							)}
						>
							{rowResults.allowed ? (
								<>
									<Check className="h-5 w-5 text-green-500" />
									<span className="text-green-400">Allowed</span>
								</>
							) : (
								<>
									<X className="h-5 w-5 text-red-500" />
									<span className="text-red-400">Denied</span>
								</>
							)}
						</div>

						<div className="mt-4 space-y-2">
							<span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
								Applied Policies
							</span>
							{rowResults.appliedPolicies?.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No policies on this table
								</p>
							) : (
								<div className="flex flex-wrap gap-1">
									{rowResults.appliedPolicies?.map((policy: string) => (
										<span
											key={policy}
											className="rounded-md bg-secondary px-2 py-1 font-mono text-foreground text-xs"
										>
											{policy}
										</span>
									))}
								</div>
							)}
						</div>

						{rowResults.rowSnapshot && (
							<div className="mt-4 space-y-2">
								<span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
									Row Snapshot
								</span>
								<pre className="overflow-auto rounded-md border border-input bg-background p-3 font-mono text-foreground text-xs">
									{JSON.stringify(rowResults.rowSnapshot, null, 2)}
								</pre>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export default SimulatePage;
