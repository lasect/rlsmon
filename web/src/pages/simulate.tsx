import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Play,
	Plus,
	Shield,
	Table2,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/api/trpc";
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

type SimMode = "table" | "row-access";

interface JwtClaim {
	key: string;
	value: string;
}

interface SimulateConfig {
	mode: SimMode;
	role: string;
	table: string;
	claims: JwtClaim[];
	rowId: string;
}

interface TableRow {
	[col: string]: unknown;
}

function loadConfig(): SimulateConfig {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed.mode && parsed.table) {
				return {
					mode: parsed.mode || "table",
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
		mode: "table",
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

function ModeToggle({
	mode,
	onChange,
}: {
	mode: SimMode;
	onChange: (mode: SimMode) => void;
}) {
	return (
		<div className="flex h-8 rounded-full border border-border bg-surface-raised p-0.5">
			<button
				type="button"
				onClick={() => onChange("table")}
				className={cn(
					"flex-1 rounded-full font-medium text-[11px] transition-all",
					mode === "table"
						? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
						: "text-text-muted hover:text-text",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Table2 className="h-3 w-3" />
					Table Simulation
				</div>
			</button>
			<button
				type="button"
				onClick={() => onChange("row-access")}
				className={cn(
					"flex-1 rounded-full font-medium text-[11px] transition-all",
					mode === "row-access"
						? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
						: "text-text-muted hover:text-text",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Shield className="h-3 w-3" />
					Row Access Check
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
	const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));
	const [isRunning, setIsRunning] = useState(false);
	const [hasRun, setHasRun] = useState(false);

	const [schema, tableName] = config.table ? config.table.split(".") : ["", ""];

	const metaQuery = trpc.meta.get.useQuery();
	const rolesQuery = trpc.roles.list.useQuery();
	const rowAccessQuery = trpc.rowAccess.getRows.useQuery(
		{ schema: schema || "", table: tableName || "" },
		{ enabled: !!schema && !!tableName },
	);
	const policiesQuery = trpc.policies.getByTable.useQuery(
		{ schema: schema || "", table: tableName || "" },
		{ enabled: !!schema && !!tableName },
	);
	const simulateMutation = trpc.simulate.select.useMutation();
	const checkAccessMutation = trpc.rowAccess.checkAccess.useMutation();

	const tables = useMemo(
		() =>
			metaQuery.data?.tables.map((t) => `${t.schema}.${t.name}`).sort() ?? [],
		[metaQuery.data],
	);
	const roles = useMemo(
		() => rolesQuery.data?.map((r) => r.name).sort() ?? [],
		[rolesQuery.data],
	);
	const policies = useMemo(
		() => policiesQuery.data ?? [],
		[policiesQuery.data],
	);

	const primaryKeys = rowAccessQuery.data?.primaryKeys ?? [];
	const tableRows = rowAccessQuery.data?.rows ?? [];

	const canRun = useMemo(() => {
		if (!config.table) return false;
		if (config.mode === "table" && !config.role) return false;
		if (config.mode === "row-access" && !config.rowId) return false;
		return true;
	}, [config.table, config.role, config.mode, config.rowId]);

	interface RoleAccessItem {
		role: string;
		attributes?: { superuser?: boolean; bypassRls?: boolean };
		reason?: string;
	}

	interface SimulationResult {
		columns: string[];
		rows: TableRow[];
		canAccess?: RoleAccessItem[];
		cannotAccess?: RoleAccessItem[];
		rowSnapshot?: TableRow;
		error?: string;
	}

	const claimsObject = useMemo(() => {
		const obj: Record<string, unknown> = {};
		for (const claim of config.claims) {
			if (claim.key) {
				obj[claim.key] = claim.value;
			}
		}
		return obj;
	}, [config.claims]);

	const [results, setResults] = useState<SimulationResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleRun = async () => {
		if (!canRun) return;
		setIsRunning(true);
		setError(null);
		setResults(null);
		setExpandedRows(new Set([0]));
		setHasRun(true);

		try {
			if (config.mode === "table") {
				const result = await simulateMutation.mutateAsync({
					schema,
					table: tableName,
					role: config.role,
					jwtClaims: claimsObject,
				});
				setResults({
					columns: result.columns,
					rows: result.rows,
				});
			} else {
				const selectedRow = tableRows.find((r) => {
					const pkVals = primaryKeys.map((pk) => `${pk}=${r[pk]}`).join(",");
					return pkVals === config.rowId;
				});
				if (!selectedRow) return;

				const pkValues: Record<string, unknown> = {};
				for (const pk of primaryKeys) {
					const val = selectedRow[pk];
					if (val !== undefined) {
						pkValues[pk] = val;
					}
				}
				const accessResult = await checkAccessMutation.mutateAsync({
					schema,
					table: tableName,
					pkValues,
					jwtClaims:
						Object.keys(claimsObject).length > 0 ? claimsObject : undefined,
				});

				const isFullResult = "canAccess" in accessResult;
				setResults({
					columns: primaryKeys,
					rows: [selectedRow],
					canAccess: isFullResult
						? (accessResult.canAccess as RoleAccessItem[])
						: [],
					cannotAccess: isFullResult
						? (accessResult.cannotAccess as RoleAccessItem[])
						: [],
					rowSnapshot: selectedRow,
				});
			}
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setIsRunning(false);
		}
	};

	const updateConfig = (updates: Partial<SimulateConfig>) => {
		setConfig((prev) => ({ ...prev, ...updates }));
		setResults(null);
		setError(null);
		setHasRun(false);
	};

	const toggleRowExpansion = (index: number) => {
		setExpandedRows((prev) => {
			if (prev.has(index)) {
				return new Set();
			}
			return new Set([index]);
		});
	};

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
	}, [canRun, handleRun]);

	useEffect(() => {
		saveConfig(config);
	}, [config]);

	return (
		<div className="flex h-full">
			<div className="flex w-[34%] min-w-[320px] max-w-[400px] shrink-0 flex-col border-border border-r bg-surface">
				<div className="flex-shrink-0 border-border border-b px-4 py-3">
					<h1 className="font-medium text-sm text-text">
						Explainable Simulation
					</h1>
					<p className="text-[11px] text-text-muted">
						Debug RLS with visibility explanations
					</p>
				</div>

				<div className="flex flex-1 flex-col overflow-y-auto p-4">
					<div className="space-y-5">
						<div className="space-y-2">
							<p className="font-medium text-[10px] text-text-muted uppercase tracking-wider">
								Mode
							</p>
							<ModeToggle
								mode={config.mode}
								onChange={(mode) => updateConfig({ mode })}
							/>
						</div>

						<div className="space-y-3">
							<p className="font-medium text-[10px] text-text-muted uppercase tracking-wider">
								Context
							</p>
							<div className="space-2.5">
								{config.mode === "table" && (
									<div className="space-1.5">
										<span className="text-[10px] text-text-muted">Role</span>
										<Select
											value={config.role}
											onValueChange={(value) => updateConfig({ role: value })}
										>
											<SelectTrigger className="h-9">
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
								)}
								<div className="space-1.5">
									<span className="text-[10px] text-text-muted">Table</span>
									<Select
										value={config.table}
										onValueChange={(value) =>
											updateConfig({ table: value, rowId: "" })
										}
									>
										<SelectTrigger className="h-9">
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
						</div>

						<div className="space-y-2">
							<p className="flex items-center gap-1 font-medium text-[10px] text-text-muted uppercase tracking-wider">
								JWT Claims
								<span className="font-normal text-[9px] normal-case">
									(optional)
								</span>
							</p>
							<div className="space-y-2">
								{config.claims.length === 0 && (
									<p className="text-[11px] text-text-muted">
										No claims provided
									</p>
								)}
								{config.claims.map((claim, index) => (
									<div key={index} className="group flex items-center gap-1">
										<input
											type="text"
											value={claim.key}
											onChange={(e) => {
												const updated = [...config.claims];
												updated[index].key = e.target.value;
												updateConfig({ claims: updated });
											}}
											placeholder="key"
											className="h-8 w-[35%] rounded-md border border-border bg-surface-raised px-2 font-mono text-xs placeholder:text-text-muted focus:border-emerald-500/50 focus:outline-none"
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
											className="h-8 flex-1 rounded-md border border-border bg-surface-raised px-2 font-mono text-xs placeholder:text-text-muted focus:border-emerald-500/50 focus:outline-none"
										/>
										<button
											type="button"
											onClick={() => {
												const updated = config.claims.filter(
													(_, i) => i !== index,
												);
												updateConfig({
													claims:
														updated.length > 0
															? updated
															: [{ key: "", value: "" }],
												});
											}}
											className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted opacity-0 transition-opacity hover:border-red-500/50 hover:text-red-400 group-hover:opacity-100"
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
									className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text"
								>
									<Plus className="size-3" />
									Add claim
								</button>
							</div>
						</div>

						<div className="space-y-2">
							<p className="font-medium text-[10px] text-text-muted uppercase tracking-wider">
								Action
							</p>
							<div className="flex items-center gap-2">
								<Button
									onClick={handleRun}
									disabled={!canRun || isRunning}
									size="sm"
									className="h-9"
								>
									{isRunning ? (
										<span className="flex items-center gap-2">Running...</span>
									) : config.mode === "table" ? (
										<span className="flex items-center gap-1.5">
											<Play className="size-3" />
											Run Simulation
										</span>
									) : (
										<span className="flex items-center gap-1.5">
											<Shield className="size-3" />
											Check Access
										</span>
									)}
								</Button>
								<span className="text-[10px] text-text-muted">Cmd + Enter</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden bg-surface-raised">
				{config.mode === "row-access" && config.table && (
					<RowSelector
						rows={tableRows}
						columns={rowAccessQuery.data?.columns ?? []}
						primaryKeys={primaryKeys}
						selectedRowId={config.rowId}
						onSelect={(rowId) => {
							setConfig((prev) => ({ ...prev, rowId }));
						}}
					/>
				)}

				{hasRun && error && (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
							<p className="mt-3 text-sm text-text">{error}</p>
						</div>
					</div>
				)}

				{config.mode === "table" &&
					hasRun &&
					results &&
					results.rows.length > 0 && (
						<div className="flex flex-1 flex-col overflow-hidden">
							<div className="flex-shrink-0 border-border border-b bg-surface-raised px-4 py-3">
								<h2 className="font-medium text-sm text-text">
									Simulation Result
								</h2>
								<p className="mt-0.5 text-[13px] text-emerald-400">
									<span className="font-semibold">{results.rows.length}</span>
									<span className="text-text-muted">
										{" "}
										/ {tableRows.length} rows visible
									</span>
								</p>
							</div>

							<div className="flex-1 overflow-auto">
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 bg-surface-raised">
										<tr>
											<th className="w-8 border-border border-b bg-surface" />
											{results.columns.map((col: string) => (
												<th
													key={col}
													className="border-border border-b bg-surface px-3 py-2.5 font-medium text-text-muted uppercase tracking-wider"
												>
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{results.rows.map((row: TableRow, idx: number) => {
											const isExpanded = expandedRows.has(idx);
											return (
												<>
													<tr
														key={idx}
														className={cn(
															"group cursor-pointer transition-colors hover:bg-surface",
															isExpanded && "bg-surface",
														)}
														onClick={() => toggleRowExpansion(idx)}
													>
														<td className="w-8 border-border border-b px-2 py-3 text-center">
															{isExpanded ? (
																<ChevronDown className="inline h-3.5 w-3.5 text-text-muted" />
															) : (
																<ChevronRight className="inline h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100" />
															)}
														</td>
														{results.columns.map((col: string) => (
															<td
																key={col}
																className="max-w-[200px] truncate border-border border-b px-3 py-3 font-mono text-text"
															>
																{formatCellValue(row[col])}
															</td>
														))}
													</tr>
													{isExpanded && (
														<tr className="bg-surface">
															<td
																colSpan={results.columns.length + 1}
																className="border-border border-b"
															>
																<div className="mx-4 my-3 rounded-md border-emerald-500/50 border-l-2 bg-surface-raised px-4 py-3">
																	<div className="flex items-center gap-2">
																		<h3 className="font-medium text-sm text-text">
																			Why is this row visible?
																		</h3>
																		<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
																			Allowed by policy
																		</span>
																	</div>
																	<div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[11px]">
																		<span className="text-text-muted">
																			Policy:
																		</span>
																		<code className="font-mono text-text">
																			{policies[0]?.name ?? "tenant_isolation"}
																		</code>
																		<span className="text-text-muted">
																			Using:
																		</span>
																		<code className="font-mono text-text">
																			{policies[0]?.using ??
																				"(tenant_id = current_setting('app.tenant_id'))"}
																		</code>
																		<span className="text-text-muted">
																			Role:
																		</span>
																		<code className="font-mono text-text">
																			{config.role}
																		</code>

																		{Object.keys(claimsObject).length > 0 && (
																			<>
																				<span className="text-text-muted">
																					Claims:
																				</span>
																				<code className="font-mono text-text">
																					{JSON.stringify(claimsObject)}
																				</code>
																			</>
																		)}
																	</div>
																</div>
															</td>
														</tr>
													)}
												</>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}

				{config.mode === "row-access" &&
					hasRun &&
					results &&
					results.canAccess && (
						<div className="flex flex-1 flex-col overflow-hidden">
							<div className="flex-shrink-0 border-border border-b bg-surface-raised px-4 py-3">
								<h2 className="font-medium text-sm text-text">
									Row Access Check
								</h2>
								<p className="mt-0.5 text-[13px] text-text-muted">
									Row: {config.rowId}
								</p>
							</div>
							<div className="flex-1 overflow-auto p-4">
								<div className="mb-4 space-y-2">
									<div className="rounded border border-border bg-surface p-3">
										<div className="mb-1 font-medium text-[10px] text-text-muted uppercase tracking-wider">
											Selected Row
										</div>
										<code className="font-mono text-xs">
											{results.rowSnapshot
												? Object.entries(results.rowSnapshot)
														.slice(0, 4)
														.map(([k, v]) => `${k}=${formatCellValue(v)}`)
														.join(", ")
												: config.rowId}
										</code>
									</div>
								</div>

								<div className="space-y-4">
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<User className="size-4 text-emerald-400" />
											<span className="font-medium text-sm text-text">
												Can access
											</span>
											<span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
												{results.canAccess?.length ?? 0}
											</span>
										</div>
										<div className="space-y-1 border-l-2 border-l-emerald-500/30 pl-3">
											{results.canAccess?.length === 0 ? (
												<div className="py-2 text-[11px] text-text-muted">
													No roles can access this row
												</div>
											) : (
												results.canAccess?.map((item) => (
													<div
														key={item.role}
														className="flex items-center gap-2 py-1"
													>
														<span className="font-mono text-text text-xs">
															{item.role}
														</span>
														{item.attributes?.superuser && (
															<span className="rounded bg-purple-500/20 px-1 py-0.5 text-[9px] text-purple-400">
																SU
															</span>
														)}
														{item.attributes?.bypassRls && (
															<span className="rounded bg-blue-500/20 px-1 py-0.5 text-[9px] text-blue-400">
																BYPASS
															</span>
														)}
													</div>
												))
											)}
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<X className="size-4 text-red-400" />
											<span className="font-medium text-sm text-text">
												Cannot access
											</span>
											<span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
												{results.cannotAccess?.length ?? 0}
											</span>
										</div>
										<div className="space-y-1 border-l-2 border-l-red-500/30 pl-3">
											{results.cannotAccess?.length === 0 ? (
												<div className="py-2 text-[11px] text-text-muted">
													All roles can access this row
												</div>
											) : (
												results.cannotAccess?.map((item) => (
													<div
														key={item.role}
														className="flex items-center gap-2 py-1"
													>
														<span className="font-mono text-text text-xs">
															{item.role}
														</span>
														<span
															className={cn(
																"rounded px-1 py-0.5 text-[9px]",
																item.reason === "rls_filtered"
																	? "bg-amber-500/20 text-amber-400"
																	: "bg-red-500/20 text-red-400",
															)}
														>
															{item.reason === "rls_filtered"
																? "rls filtered"
																: "no privilege"}
														</span>
													</div>
												))
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

				{hasRun && results && results.rows.length === 0 && (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
							<p className="mt-3 font-medium text-sm text-text">
								No rows visible
							</p>
							<p className="mt-1 text-[11px] text-text-muted">
								All policies restrict access
							</p>
						</div>
					</div>
				)}

				{!hasRun && (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<Play className="mx-auto h-8 w-8 text-text-muted opacity-50" />
							<p className="mt-3 font-medium text-sm text-text">
								No simulation yet
							</p>
							<p className="mt-1 text-[11px] text-text-muted">
								Run a simulation to inspect row visibility
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function RowSelector({
	rows,
	columns,
	primaryKeys,
	selectedRowId,
	onSelect,
}: {
	rows: TableRow[];
	columns: string[];
	primaryKeys: string[];
	selectedRowId: string;
	onSelect: (rowId: string) => void;
}) {
	const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);

	useEffect(() => {
		if (selectedRowId && rows.length > 0) {
			const found = rows.find((r) => {
				const pkVals = primaryKeys.map((pk) => `${pk}=${r[pk]}`).join(",");
				return pkVals === selectedRowId;
			});
			if (found) setSelectedRow(found);
		}
	}, [selectedRowId, rows, primaryKeys]);

	const handleSelect = (row: TableRow) => {
		const pkVals = primaryKeys.map((pk) => `${pk}=${row[pk]}`).join(",");
		onSelect(pkVals);
		setSelectedRow(row);
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex-shrink-0 items-center justify-between border-border border-b bg-surface px-4 py-2">
				<span className="font-mono text-text text-xs">{columns.join(".")}</span>
				<span className="rounded bg-surface-raised px-2 py-0.5 text-[10px] text-text-muted">
					{rows.length} rows (browsing)
				</span>
			</div>
			<div className="flex-1 overflow-auto">
				<table className="w-full text-left text-xs">
					<thead className="sticky top-0 bg-surface-raised">
						<tr>
							{columns.map((col) => (
								<th
									key={col}
									className="border-border border-b bg-surface px-3 py-2 font-medium text-text-muted uppercase tracking-wider"
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => {
							const isSelected =
								selectedRow &&
								primaryKeys.every((pk) => row[pk] === selectedRow[pk]);
							return (
								<tr
									key={i}
									className={cn(
										"group cursor-pointer transition-colors hover:bg-surface",
										isSelected &&
											"border-l-2 border-l-emerald-500 bg-emerald-500/5",
									)}
									onClick={() => handleSelect(row)}
								>
									{columns.map((col) => (
										<td
											key={col}
											className="max-w-[200px] truncate border-border border-b px-3 py-2 font-mono text-text"
										>
											{formatCellValue(row[col])}
										</td>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{rows.length > 0 && (
				<div className="flex h-7 flex-shrink-0 items-center border-border border-t bg-surface px-3">
					<div className="text-[11px] text-text-muted">
						Click a row to select it, then run the simulation
					</div>
				</div>
			)}
		</div>
	);
}

export default SimulatePage;
