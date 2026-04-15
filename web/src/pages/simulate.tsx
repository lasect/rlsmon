import {
	AlertTriangle,
	Clipboard,
	Play,
	Plus,
	Table,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { CellRenderer } from "@/components/simulate/json-cell";
import { RowDrawer } from "@/components/simulate/row-drawer";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePersona } from "@/context/persona-context";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rlsmon:simulate:lastConfig";

interface JwtClaim {
	key: string;
	value: string;
}

interface SimulateConfig {
	role: string;
	table: string;
	claims: JwtClaim[];
}

function loadConfig(): SimulateConfig | null {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return null;
		const parsed = JSON.parse(saved);
		if (parsed.role && parsed.table) {
			return {
				role: parsed.role,
				table: parsed.table,
				claims: parsed.claims || [{ key: "", value: "" }],
			};
		}
		return null;
	} catch {
		return null;
	}
}

function saveConfig(config: SimulateConfig): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// localStorage unavailable
	}
}

export function SimulatePage() {
	const { setPersona } = usePersona();
	const [selectedRole, setSelectedRole] = useState<string>("");
	const [selectedTable, setSelectedTable] = useState<string>("");
	const [jwtClaims, setJwtClaims] = useState<JwtClaim[]>([
		{ key: "", value: "" },
	]);
	const [rawJsonMode, setRawJsonMode] = useState(false);
	const [rawJson, setRawJson] = useState("{}");
	const [rawJsonError, setRawJsonError] = useState<string>("");
	const [selectedRow, setSelectedRow] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

	const rolesQuery = trpc.roles.list.useQuery();
	const metaQuery = trpc.meta.get.useQuery();
	const simulateMutation = trpc.simulate.select.useMutation();

	// Load persisted config on mount
	useEffect(() => {
		const saved = loadConfig();
		if (saved) {
			setSelectedRole(saved.role);
			setSelectedTable(saved.table);
			if (saved.claims && saved.claims.length > 0) {
				setJwtClaims(saved.claims);
			}
		}
	}, []);

	// Cmd+Enter to run
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isModifier = e.metaKey || e.ctrlKey;
			if (isModifier && e.key === "Enter") {
				e.preventDefault();
				if (selectedRole && selectedTable && !simulateMutation.isPending) {
					handleRun();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectedRole, selectedTable, simulateMutation.isPending]);

	const tables =
		metaQuery.data?.tables.map((t) => `${t.schema}.${t.name}`).sort() ?? [];

	const policyTableSet = new Set(
		metaQuery.data?.policies.map((p) => `${p.schema}.${p.table}`) ?? [],
	);
	const rlsCoverage = metaQuery.data
		? Math.round(
				(metaQuery.data.tables.filter((t) =>
					policyTableSet.has(`${t.schema}.${t.name}`),
				).length /
					metaQuery.data.tables.length) *
					100,
			)
		: 0;

	// Get relevant policies for selected table
	const relevantPolicies = useMemo(() => {
		if (!selectedTable || !metaQuery.data) return [];
		const [schema, table] = selectedTable.split(".");
		return metaQuery.data.policies.filter(
			(p) => p.schema === schema && p.table === table,
		);
	}, [selectedTable, metaQuery.data]);

	const handleRun = async () => {
		if (!selectedRole || !selectedTable) return;

		const [schema, table] = selectedTable.split(".");
		let claims: Record<string, unknown> = {};

		if (rawJsonMode) {
			try {
				claims = JSON.parse(rawJson);
			} catch {
				return;
			}
		} else {
			for (const claim of jwtClaims) {
				if (claim.key) {
					try {
						claims[claim.key] = JSON.parse(claim.value);
					} catch {
						claims[claim.key] = claim.value;
					}
				}
			}
		}

		setPersona({
			role: selectedRole,
			claims,
			table: selectedTable,
			lastRunAt: Date.now(),
		});

		// Persist config
		saveConfig({
			role: selectedRole,
			table: selectedTable,
			claims: jwtClaims,
		});

		simulateMutation.mutate({
			schema,
			table,
			role: selectedRole,
			jwtClaims: Object.keys(claims).length > 0 ? claims : undefined,
		});
	};

	const addClaimRow = () => {
		setJwtClaims([...jwtClaims, { key: "", value: "" }]);
	};

	const removeClaimRow = (index: number) => {
		setJwtClaims(jwtClaims.filter((_, i) => i !== index));
	};

	const updateClaim = (index: number, field: keyof JwtClaim, value: string) => {
		const updated = [...jwtClaims];
		updated[index][field] = value;
		setJwtClaims(updated);
	};

	const handleRawJsonChange = (value: string) => {
		setRawJson(value);
		try {
			JSON.parse(value);
			setRawJsonError("");
		} catch {
			setRawJsonError("Invalid JSON");
		}
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

	const rolesLoading = rolesQuery.isLoading;
	const metaLoading = metaQuery.isLoading;
	const tablesLoading = metaLoading;
	const canRun = selectedRole && selectedTable && !simulateMutation.isPending;

	return (
		<div className="flex h-full">
			<div className="flex w-[280px] flex-shrink-0 flex-col border-border border-r bg-card">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<h1 className="font-semibold text-sm">Persona Simulation</h1>
					<p className="text-[11px] text-muted-foreground">
						Simulate RLS as a specific role
					</p>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="flex-1 overflow-y-auto px-3">
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Role
								</label>
								<Select value={selectedRole} onValueChange={setSelectedRole}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="Select role..." />
									</SelectTrigger>
									<SelectContent>
										{rolesLoading ? (
											<div className="p-2 text-muted-foreground text-xs">
												Loading...
											</div>
										) : (
											rolesQuery.data?.map((role) => (
												<SelectItem
													key={role.name}
													value={role.name}
													className="text-xs"
												>
													{role.name}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="border-white/5 border-b" />

							<div className="space-y-2">
								<label className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									JWT Claims
								</label>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setRawJsonMode(false)}
										className={cn(
											"rounded px-1.5 py-0.5 text-[10px] transition-colors",
											!rawJsonMode
												? "bg-muted text-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										Key/Value
									</button>
									<button
										type="button"
										onClick={() => setRawJsonMode(true)}
										className={cn(
											"rounded px-1.5 py-0.5 text-[10px] transition-colors",
											rawJsonMode
												? "bg-muted text-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										Raw JSON
									</button>
								</div>

								{rawJsonMode ? (
									<div className="space-y-1">
										<textarea
											value={rawJson}
											onChange={(e) => handleRawJsonChange(e.target.value)}
											placeholder='{"user_id": 123}'
											className={cn(
												"min-h-[80px] w-full rounded border border-border bg-background p-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none",
												rawJsonError && "border-red-500",
											)}
										/>
										{rawJsonError && (
											<p className="text-[10px] text-red-400">{rawJsonError}</p>
										)}
									</div>
								) : (
									<div className="space-y-1">
										{jwtClaims.map((claim, index) => (
											<div key={index} className="flex items-center gap-1">
												<input
													type="text"
													value={claim.key}
													onChange={(e) =>
														updateClaim(index, "key", e.target.value)
													}
													placeholder="key"
													className="h-7 w-[35%] rounded-l border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
												/>
												<input
													type="text"
													value={claim.value}
													onChange={(e) =>
														updateClaim(index, "value", e.target.value)
													}
													placeholder="value"
													className="h-7 w-[65%] rounded-r border border-border bg-background px-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
												/>
												<button
													type="button"
													onClick={() => removeClaimRow(index)}
													className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
												>
													<Trash2 className="size-3" />
												</button>
											</div>
										))}
										<button
											type="button"
											onClick={addClaimRow}
											className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
										>
											<Plus className="size-3" />
											Add Claim
										</button>
									</div>
								)}
							</div>

							<div className="border-white/5 border-b" />

							<details className="group">
								<summary className="flex cursor-pointer list-outside items-center gap-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground">
									<span>Seed Rows</span>
									<span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-400">
										<AlertTriangle className="size-2.5" />
										Coming Soon
									</span>
								</summary>
								<div className="mt-2 space-y-1">
									<p className="rounded bg-amber-500/10 p-2 text-[10px] text-amber-400/80">
										This feature is not yet implemented. Rows are never
										committed — they are cleaned up automatically after
										simulation.
									</p>
									<textarea
										placeholder='[{"id": 1, "name": "test"}]'
										disabled
										className="min-h-[60px] w-full cursor-not-allowed rounded border border-border bg-background p-2 font-mono text-[11px] text-muted-foreground opacity-50 placeholder:text-muted-foreground"
									/>
								</div>
							</details>

							<div className="border-white/5 border-b" />

							<div className="space-y-2">
								<label className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Table
								</label>
								<Select value={selectedTable} onValueChange={setSelectedTable}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="Select table..." />
									</SelectTrigger>
									<SelectContent>
										{tablesLoading ? (
											<div className="p-2 text-muted-foreground text-xs">
												Loading...
											</div>
										) : (
											tables.map((table) => (
												<SelectItem
													key={table}
													value={table}
													className="font-mono text-xs"
												>
													{table}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					<div className="sticky bottom-0 border-white/5 border-t bg-card p-3">
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="block w-full">
									<Button
										onClick={handleRun}
										disabled={!canRun}
										className={cn(
											"w-full",
											!canRun && "cursor-not-allowed opacity-50",
										)}
									>
										{simulateMutation.isPending ? (
											<span className="flex items-center gap-2">
												<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
												Running...
											</span>
										) : (
											<span className="flex items-center">
												<Play className="mr-2 size-4" />
												Run
												<span className="ml-2 text-[10px] text-muted-foreground">
													⌘↵
												</span>
											</span>
										)}
									</Button>
								</span>
							</TooltipTrigger>
							{!canRun && (
								<TooltipContent>
									<p className="text-[10px]">Select a role and table to run</p>
								</TooltipContent>
							)}
						</Tooltip>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col">
				<div className="flex flex-shrink-0 items-center justify-between border-border border-b px-4 py-2">
					<div className="flex items-center gap-2">
						<Table className="size-4 text-muted-foreground" />
						<span className="font-mono text-xs">
							{simulateMutation.variables?.table ?? "—"}
						</span>
					</div>
					{!simulateMutation.isPending && metaQuery.data && (
						<div className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
							{rlsCoverage}% RLS coverage
						</div>
					)}
				</div>

				<div className="flex-1 overflow-auto">
					{!simulateMutation.data &&
						!simulateMutation.isPending &&
						!simulateMutation.error && (
							<div className="flex h-full items-center justify-center">
								<div className="flex flex-col items-center gap-2 text-center">
									<Table className="size-10 text-muted-foreground/30" />
									<p className="font-medium text-sm">No simulation run yet</p>
									<p className="text-muted-foreground text-xs">
										Select a role and table, then hit Run
									</p>
								</div>
							</div>
						)}

					{simulateMutation.isPending && (
						<div className="p-4">
							<div className="space-y-2">
								{[1, 2, 3, 4].map((i) => (
									<div key={i} className="flex gap-2">
										<div className="h-6 w-24 animate-pulse rounded bg-white/5" />
										<div className="h-6 w-32 animate-pulse rounded bg-white/5" />
										<div className="h-6 w-20 animate-pulse rounded bg-white/5" />
										<div className="h-6 w-28 animate-pulse rounded bg-white/5" />
									</div>
								))}
							</div>
						</div>
					)}

					{simulateMutation.error && (
						<div className="flex h-full items-center justify-center p-4">
							<ApiErrorCard
								error={simulateMutation.error}
								retry={() =>
									simulateMutation.mutate({
										schema: selectedTable.split(".")[0] || "",
										table: selectedTable.split(".")[1] || "",
										role: selectedRole,
									})
								}
								endpoint="/api/simulate"
							/>
						</div>
					)}

					{simulateMutation.data?.error && (
						<div className="flex h-full items-center justify-center">
							<div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
								<p className="font-medium text-red-400 text-xs">Error</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{simulateMutation.data.error}
								</p>
							</div>
						</div>
					)}

					{simulateMutation.data &&
						!simulateMutation.data.error &&
						simulateMutation.data.rows.length > 0 && (
							<div className="relative">
								<div className="overflow-x-auto">
									<table className="border-collapse">
										<thead>
											<tr>
												{simulateMutation.data.columns.map((col) => (
													<th
														key={col}
														className="border-border border-b bg-muted/30 px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
													>
														{col}
													</th>
												))}
												<th className="w-10 border-border border-b bg-muted/30" />
											</tr>
										</thead>
										<tbody>
											{simulateMutation.data.rows.map((row, i) => {
												const columnValues = simulateMutation.data.columns.map(
													(col) => row[col],
												);
												return (
													<tr
														key={i}
														className="group/row cursor-pointer hover:bg-white/5"
														onClick={() => {
															setSelectedRow(row);
															setSelectedColumns(
																simulateMutation.data!.columns,
															);
														}}
													>
														{simulateMutation.data.columns.map((col) => (
															<td
																key={col}
																className="border-border border-b px-3 py-1.5 font-mono text-[11px]"
															>
																<CellRenderer
																	value={row[col]}
																	allColumnValues={columnValues}
																/>
															</td>
														))}
														<td className="border-border border-b px-2 py-1.5 text-center">
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	copyRowToClipboard(row);
																}}
																className="opacity-0 hover:text-foreground group-hover/row:opacity-100"
															>
																<Clipboard className="size-3 text-muted-foreground hover:text-foreground" />
															</button>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
								<div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-background to-transparent" />
							</div>
						)}

					{simulateMutation.data &&
						!simulateMutation.data.error &&
						simulateMutation.data.rows.length === 0 && (
							<div className="flex h-full items-center justify-center">
								<div className="text-muted-foreground text-xs">
									No rows returned
								</div>
							</div>
						)}
				</div>

				{simulateMutation.data && !simulateMutation.data.error && (
					<div className="flex h-7 flex-shrink-0 items-center justify-between border-border border-t bg-card px-3">
						<div className="text-[11px] text-muted-foreground">
							{simulateMutation.data.rows.length} row
							{simulateMutation.data.rows.length !== 1 ? "s" : ""}
							{relevantPolicies.length > 0 && (
								<span className="ml-1">
									· policies: {relevantPolicies.map((p) => p.name).join(", ")}
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			<RowDrawer
				open={!!selectedRow}
				onClose={() => setSelectedRow(null)}
				row={selectedRow}
				columns={selectedColumns}
			/>
		</div>
	);
}
