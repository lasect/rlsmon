import {
	AlertTriangle,
	Check,
	Copy,
	Play,
	Plus,
	Shield,
	Table2,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { CellRenderer } from "@/components/simulate/json-cell";
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
		<div className="flex rounded-md border border-input bg-background p-0.5">
			<button
				type="button"
				onClick={() => onChange("table")}
				className={cn(
					"flex-1 rounded py-1.5 font-medium text-xs transition-colors",
					mode === "table"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Table2 className="h-3.5 w-3.5" />
					Table Simulation
				</div>
			</button>
			<button
				type="button"
				onClick={() => onChange("row-access")}
				className={cn(
					"flex-1 rounded py-1.5 font-medium text-xs transition-colors",
					mode === "row-access"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				<div className="flex items-center justify-center gap-1.5">
					<Shield className="h-3.5 w-3.5" />
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

function formatRowSummary(
	row: Record<string, unknown>,
	columns: string[],
): string {
	const keyCols = columns.slice(0, 3);
	return keyCols
		.map((col) => {
			const val = row[col];
			const display =
				typeof val === "string" && val.length > 12
					? `${val.slice(0, 12)}...`
					: typeof val === "object"
						? `${JSON.stringify(val).slice(0, 12)}...`
						: String(val);
			return `${col}: ${display}`;
		})
		.join(" · ");
}

export function SimulatePage() {
	const navigate = useNavigate();
	const [config, setConfig] = useState<SimulateConfig>(loadConfig);
	const [selectedRowData, setSelectedRowData] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [results, setResults] = useState<unknown>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [viewMode, setViewMode] = useState<"browse" | "results">("browse");

	const [schema, tableName] = config.table ? config.table.split(".") : ["", ""];

	const metaQuery = trpc.meta.get.useQuery();
	const rolesQuery = trpc.roles.list.useQuery();
	const rowAccessQuery = trpc.rowAccess.getRows.useQuery(
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
		setViewMode("browse");
	}, [config.role, config.table, config.mode]);

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
		if (!config.table) return false;
		if (config.mode === "table" && !config.role) return false;
		if (config.mode === "row-access" && !selectedRowData) return false;
		return true;
	}, [config.table, config.role, config.mode, selectedRowData]);

	const handleRun = async () => {
		if (!canRun) return;
		setIsRunning(true);
		setResults(null);

		try {
			if (config.mode === "table") {
				const result = await simulateMutation.mutateAsync({
					schema,
					table: tableName,
					role: config.role,
					jwtClaims: claimsObject,
				});
				setResults({ type: "table", data: result });
				setViewMode("results");
			} else {
				const pkValues: Record<string, unknown> = {};
				for (const pk of primaryKeys) {
					const val = selectedRowData?.[pk];
					if (val !== undefined) {
						pkValues[pk] = val;
					}
				}
				const result = await checkAccessMutation.mutateAsync({
					schema,
					table: tableName,
					pkValues,
					jwtClaims:
						Object.keys(claimsObject).length > 0 ? claimsObject : undefined,
				});
				setResults({ type: "row-access", data: result });
				setViewMode("results");
			}
		} catch (e) {
			setResults({ type: "error", error: (e as Error).message });
			setViewMode("results");
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
		setViewMode("browse");
	};

	const handleBackToBrowse = () => {
		setViewMode("browse");
		checkAccessMutation.reset();
	};

	const copyRowToClipboard = async (row: Record<string, unknown>) => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
		} catch {
			const textArea = document.createElement("textarea");
			textArea.value = JSON.stringify(row, null, 2);
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
		}
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

	const rowAccessData = results as {
		type?: string;
		data?: CheckAccessData;
	} | null;
	const checkData = rowAccessData?.data;

	const isOldStyleResponse = (
		data: unknown,
	): data is { canAccess: unknown[]; cannotAccess: unknown[] } => {
		return !!(
			data &&
			typeof data === "object" &&
			"canAccess" in data &&
			"cannotAccess" in data
		);
	};

	type RoleAccessItem = {
		role: string;
		attributes?: { superuser?: boolean; bypassRls?: boolean };
		reason?: string;
	};
	const canAccessData: RoleAccessItem[] =
		checkData && isOldStyleResponse(checkData)
			? (checkData.canAccess as RoleAccessItem[])
			: [];
	const cannotAccessData: RoleAccessItem[] =
		checkData && isOldStyleResponse(checkData)
			? (checkData.cannotAccess as RoleAccessItem[])
			: [];

	const firstCanAccessRole = canAccessData[0]?.role;

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
									Mode
								</span>
								<ModeToggle
									mode={config.mode}
									onChange={(mode) => updateConfig({ mode })}
								/>
							</div>

							<div className="flex">
								{config.mode === "table" && (
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
								)}
								<div
									className={cn(
										"space-y-2",
										config.mode === "table" && "flex-1",
									)}
								>
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

							{config.mode === "row-access" && config.table && (
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

							{config.mode === "row-access" &&
								config.table &&
								selectedRowData && (
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
									) : config.mode === "table" ? (
										<span className="flex items-center gap-2">
											<Play className="h-3.5 w-3.5" />
											Run Simulation
										</span>
									) : (
										<span className="flex items-center gap-2">
											<Shield className="h-3.5 w-3.5" />
											Check Access
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
				{viewMode === "browse" &&
					config.mode === "row-access" &&
					config.table &&
					rowAccessQuery.data && (
						<>
							<div className="flex flex-shrink-0 items-center justify-between border-input border-b px-4 py-2">
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs">{config.table}</span>
									<span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
										{rowAccessQuery.data.rows.length} rows (browsing)
									</span>
								</div>
							</div>
							<div className="flex-1 overflow-auto">
								{rowAccessQuery.data.rows.length > 0 && (
									<div className="relative">
										<div className="overflow-x-auto">
											<table className="border-collapse">
												<thead>
													<tr>
														{rowAccessQuery.data.columns.map((col) => (
															<th
																key={col}
																className="border-input border-b bg-muted/30 px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
															>
																{col}
															</th>
														))}
														<th className="w-10 border-input border-b bg-muted/30" />
													</tr>
												</thead>
												<tbody>
													{rowAccessQuery.data.rows.map((row, i) => {
														const isSelected =
															selectedRowData &&
															primaryKeys.every(
																(pk) => row[pk] === selectedRowData[pk],
															);
														return (
															<tr
																key={i}
																className={cn(
																	"group/row cursor-pointer hover:bg-white/5",
																	isSelected &&
																		"border-l-2 border-l-primary bg-primary/5",
																)}
																onClick={() => handleSelectRow(row)}
															>
																{rowAccessQuery.data.columns.map((col) => (
																	<td
																		key={col}
																		className="border-input border-b px-3 py-1.5 font-mono text-[11px]"
																	>
																		<CellRenderer
																			value={row[col]}
																			allColumnValues={rowAccessQuery.data.columns.map(
																				(c) => row[c],
																			)}
																		/>
																	</td>
																))}
																<td className="border-input border-b px-2 py-1.5 text-center">
																	<button
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			copyRowToClipboard(row);
																		}}
																		className="opacity-0 hover:text-foreground group-hover/row:opacity-100"
																	>
																		<Copy className="size-3 text-muted-foreground hover:text-foreground" />
																	</button>
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									</div>
								)}
								{rowAccessQuery.data.rows.length === 0 && (
									<div className="flex h-full items-center justify-center">
										<div className="text-muted-foreground text-xs">
											No rows in this table
										</div>
									</div>
								)}
							</div>
							{rowAccessQuery.data.rows.length > 0 && (
								<div className="flex h-7 flex-shrink-0 items-center border-input border-t bg-card px-3">
									<div className="text-[11px] text-muted-foreground">
										Click a row to select it, then hit Check Access
									</div>
								</div>
							)}
						</>
					)}

				{viewMode === "results" && (
					<>
						{config.mode === "row-access" && (
							<div className="flex-shrink-0 border-input border-b px-4 py-2">
								<button
									type="button"
									onClick={handleBackToBrowse}
									className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
								>
									← Back to browse
								</button>
							</div>
						)}

						{(results as { type?: string; error?: string })?.type ===
							"error" && (
							<div className="flex-1 overflow-auto p-4">
								<ApiErrorCard
									error={{
										message:
											(results as { error?: string }).error || "Unknown error",
									}}
								/>
							</div>
						)}

						{config.mode === "table" && tableResults && (
							<div className="flex flex-1 flex-col overflow-hidden">
								<div className="border-input border-b px-4 py-2">
									<span className="font-medium text-foreground text-sm">
										Visible to {config.role}: {tableResults.rows?.length ?? 0}{" "}
										rows
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
															className="border-input border-b bg-muted/30 px-3 py-2 font-medium text-muted-foreground uppercase tracking-wider"
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

						{config.mode === "row-access" &&
							checkData &&
							isOldStyleResponse(checkData) && (
								<div className="flex-1 overflow-auto p-4">
									<div className="mb-4 space-y-2">
										<div className="rounded border border-input bg-muted/20 p-3">
											<div className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
												Row
											</div>
											<code className="font-mono text-xs">
												{formatRowSummary(
													checkData.rowSnapshot as Record<string, unknown>,
													rowColumns,
												)}
											</code>
										</div>
									</div>

									<div className="space-y-4">
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<Check className="size-4 text-green-500" />
												<span className="font-medium text-sm">Can access</span>
												<span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">
													{canAccessData.length}
												</span>
											</div>
											<div className="space-y-1 border-l-2 border-l-green-500/30 pl-3">
												{canAccessData.length === 0 ? (
													<div className="py-2 text-muted-foreground text-xs">
														No roles can access this row
													</div>
												) : (
													canAccessData.map((item: unknown) => {
														const roleData = item as {
															role: string;
															attributes?: {
																superuser?: boolean;
																bypassRls?: boolean;
															};
														};
														return (
															<div
																key={roleData.role}
																className="flex items-center gap-2 py-1"
															>
																<User className="size-3 text-muted-foreground" />
																<span className="font-mono text-xs">
																	{roleData.role}
																</span>
																{roleData.attributes?.superuser && (
																	<span className="rounded bg-purple-500/20 px-1 py-0.5 text-[9px] text-purple-400">
																		SU
																	</span>
																)}
																{roleData.attributes?.bypassRls && (
																	<span className="rounded bg-blue-500/20 px-1 py-0.5 text-[9px] text-blue-400">
																		BYPASS
																	</span>
																)}
															</div>
														);
													})
												)}
											</div>
										</div>

										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<X className="size-4 text-red-500" />
												<span className="font-medium text-sm">
													Cannot access
												</span>
												<span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
													{cannotAccessData.length}
												</span>
											</div>
											<div className="space-y-1 border-l-2 border-l-red-500/30 pl-3">
												{cannotAccessData.length === 0 ? (
													<div className="py-2 text-muted-foreground text-xs">
														All roles can access this row
													</div>
												) : (
													cannotAccessData.map((item: unknown) => {
														const roleData = item as {
															role: string;
															reason?: string;
														};
														return (
															<div
																key={roleData.role}
																className="flex items-center gap-2 py-1"
															>
																<User className="size-3 text-muted-foreground" />
																<span className="font-mono text-xs">
																	{roleData.role}
																</span>
																<span
																	className={cn(
																		"rounded px-1 py-0.5 text-[9px]",
																		roleData.reason === "rls_filtered"
																			? "bg-amber-500/20 text-amber-400"
																			: "bg-red-500/20 text-red-400",
																	)}
																>
																	{roleData.reason === "rls_filtered"
																		? "rls filtered"
																		: "no privilege"}
																</span>
															</div>
														);
													})
												)}
											</div>
										</div>
									</div>

									<div className="mt-4 flex gap-4 text-[11px]">
										{firstCanAccessRole && (
											<button
												type="button"
												onClick={() => {
													updateConfig({
														mode: "table",
														role: firstCanAccessRole,
														table: config.table,
													});
												}}
												className="text-primary hover:underline"
											>
												Simulate as {firstCanAccessRole} →
											</button>
										)}
										<button
											type="button"
											onClick={() =>
												navigate(
													`/explore/policies?table=${encodeURIComponent(config.table)}`,
												)
											}
											className="text-primary hover:underline"
										>
											View policies for this table →
										</button>
									</div>
								</div>
							)}
					</>
				)}

				{!results && viewMode === "results" && config.mode === "table" && (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<div className="text-center">
							<Play className="mx-auto h-8 w-8 opacity-50" />
							<p className="mt-2 text-sm">Run simulation to see results</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default SimulatePage;

type CheckAccessData = {
	canAccess: unknown[];
	cannotAccess: unknown[];
	rowSnapshot?: Record<string, unknown>;
	checkedAt?: string;
};
