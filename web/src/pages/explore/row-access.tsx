import { Check, Copy, Plus, Shield, Trash2, User, X } from "lucide-react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface JwtClaim {
	key: string;
	value: string;
}

function truncate(value: unknown, length = 8): string {
	if (typeof value === "string") {
		if (value.length > length) {
			return `${value.slice(0, length)}...`;
		}
		return value;
	}
	if (typeof value === "object" && value !== null) {
		return `${JSON.stringify(value).slice(0, length)}...`;
	}
	return String(value);
}

function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	if (diff < 60000) return "just now";
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	return date.toLocaleTimeString();
}

function formatRowSummary(
	row: Record<string, unknown>,
	columns: string[],
): string {
	const keyCols = columns.slice(0, 3);
	return keyCols
		.map((col) => {
			const val = row[col];
			return `${col}: ${truncate(val, 12)}`;
		})
		.join(" · ");
}

export function RowAccessPage() {
	const navigate = useNavigate();
	const [selectedTable, setSelectedTable] = useState<string>("");
	const [selectedRow, setSelectedRow] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [jwtClaims, setJwtClaims] = useState<JwtClaim[]>([
		{ key: "", value: "" },
	]);
	const [viewMode, setViewMode] = useState<"browse" | "results">("browse");

	const metaQuery = trpc.meta.get.useQuery();

	const tables =
		metaQuery.data?.tables.map((t) => `${t.schema}.${t.name}`).sort() ?? [];

	const [schema, table] = selectedTable ? selectedTable.split(".") : ["", ""];

	const rowsQuery = trpc.rowAccess.getRows.useQuery(
		{ schema: schema || "", table: table || "" },
		{
			enabled: !!schema && !!table,
		},
	);

	const checkAccessMutation = trpc.rowAccess.checkAccess.useMutation();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isModifier = e.metaKey || e.ctrlKey;
			if (isModifier && e.key === "Enter") {
				e.preventDefault();
				if (canCheck) {
					handleCheckAccess();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	});

	const canCheck = useMemo(() => {
		if (!schema || !table) return false;
		return !!selectedRow;
	}, [schema, table, selectedRow]);

	const handleSelectRow = (row: Record<string, unknown>) => {
		setSelectedRow(row);
		setViewMode("browse");
	};

	const handleCheckAccess = () => {
		if (!schema || !table || !selectedRow) return;

		const pkValues: Record<string, unknown> = {};

		const pkCols = rowsQuery.data?.primaryKeys || [];
		for (const pk of pkCols) {
			pkValues[pk] = selectedRow[pk];
		}

		const claims: Record<string, unknown> = {};
		for (const claim of jwtClaims) {
			if (claim.key) {
				try {
					claims[claim.key] = JSON.parse(claim.value);
				} catch {
					claims[claim.key] = claim.value;
				}
			}
		}

		checkAccessMutation.mutate(
			{
				schema,
				table,
				pkValues,
				jwtClaims: Object.keys(claims).length > 0 ? claims : undefined,
			},
			{
				onSuccess: () => {
					setViewMode("results");
				},
				onError: (error) => {
					console.error("Check access failed:", error);
					setViewMode("results");
				},
			},
		);
	};

	const handleBackToBrowse = () => {
		setViewMode("browse");
		checkAccessMutation.reset();
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

	// Type guard for old-style response (all roles check)
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

	const firstCanAccessRole = isOldStyleResponse(checkAccessMutation.data)
		? checkAccessMutation.data.canAccess[0]?.role
		: undefined;

	const canAccessData = isOldStyleResponse(checkAccessMutation.data)
		? checkAccessMutation.data.canAccess
		: [];
	const cannotAccessData = isOldStyleResponse(checkAccessMutation.data)
		? checkAccessMutation.data.cannotAccess
		: [];

	return (
		<div className="flex h-full">
			<div className="flex w-[320px] flex-shrink-0 flex-col border-border border-r bg-card">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<h1 className="font-semibold text-sm">Row Access</h1>
					<p className="text-[11px] text-muted-foreground">
						Check which roles can access a specific row
					</p>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					<div className="flex-1 overflow-y-auto px-3">
						<div className="space-y-4">
							<div className="space-y-2">
								<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Table
								</span>
								<Select
									value={selectedTable}
									onValueChange={(v) => {
										setSelectedTable(v);
										setSelectedRow(null);
										setViewMode("browse");
										checkAccessMutation.reset();
									}}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="Select table..." />
									</SelectTrigger>
									<SelectContent>
										{metaQuery.isLoading ? (
											<div className="p-2 text-muted-foreground text-xs">
												Loading...
											</div>
										) : (
											tables.map((t) => (
												<SelectItem
													key={t}
													value={t}
													className="font-mono text-xs"
												>
													{t}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="border-white/5 border-b" />

							<div className="space-y-2">
								<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Row
								</span>
								<Select
									value={
										selectedRow
											? JSON.stringify(
													rowsQuery.data?.primaryKeys.map(
														(pk) => selectedRow[pk],
													),
												)
											: ""
									}
									onValueChange={(v) => {
										const row = rowsQuery.data?.rows.find((r) => {
											const pks = rowsQuery.data?.primaryKeys || [];
											return JSON.stringify(pks.map((pk) => r[pk])) === v;
										});
										if (row) handleSelectRow(row);
									}}
									disabled={!selectedTable}
								>
									<SelectTrigger className="h-8 border border-zinc-800 bg-zinc-900 text-xs">
										<SelectValue
											placeholder={
												selectedTable
													? "Select a row..."
													: "Select a table first"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{rowsQuery.isLoading ? (
											<div className="p-2 text-muted-foreground text-xs">
												Loading...
											</div>
										) : rowsQuery.data?.rows.length === 0 ? (
											<div className="p-2 text-muted-foreground text-xs">
												No rows in table
											</div>
										) : (
											rowsQuery.data?.rows.slice(0, 50).map((row, i) => {
												const pks = rowsQuery.data?.primaryKeys || [];
												const displayValue =
													pks.length > 0
														? pks.map((pk) => row[pk]).join(", ")
														: rowsQuery.data!.columns[0]
															? String(row[rowsQuery.data!.columns[0]])
															: `Row ${i}`;
												return (
													<SelectItem
														key={i}
														value={JSON.stringify(pks.map((pk) => row[pk]))}
														className="font-mono text-xs"
													>
														{displayValue}
													</SelectItem>
												);
											})
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="border-white/5 border-b" />

							<div className="space-y-2">
								<span className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									JWT Claims{" "}
									<span className="text-[9px] normal-case">(optional)</span>
								</span>
								<div className="space-y-2">
									{jwtClaims.map((claim, index) => (
										<div key={index} className="flex items-center gap-1">
											<input
												type="text"
												value={claim.key}
												onChange={(e) =>
													updateClaim(index, "key", e.target.value)
												}
												placeholder="key"
												className="h-7 w-[35%] rounded-l border border-border bg-background px-2 font-mono text-[11px] placeholder:text-muted-foreground focus:border-primary focus:outline-none"
											/>
											<input
												type="text"
												value={claim.value}
												onChange={(e) =>
													updateClaim(index, "value", e.target.value)
												}
												placeholder="value"
												className="h-7 w-[65%] rounded-r border border-border bg-background px-2 font-mono text-[11px] placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
										className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
									>
										<Plus className="size-3" />
										Add Claim
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="sticky bottom-0 border-white/5 border-t bg-card p-3">
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="block w-full">
									<Button
										onClick={handleCheckAccess}
										disabled={!canCheck || checkAccessMutation.isPending}
										className={cn(
											"w-full bg-green-600 hover:bg-green-700",
											!canCheck && "cursor-not-allowed opacity-50",
										)}
									>
										{checkAccessMutation.isPending ? (
											<span className="flex items-center gap-2">
												<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
												Checking...
											</span>
										) : (
											<span className="flex items-center gap-2">
												<Shield className="size-4" />
												Check Access
												<span className="ml-2 text-[10px] text-green-200">
													⌘↵
												</span>
											</span>
										)}
									</Button>
								</span>
							</TooltipTrigger>
							{!canCheck && (
								<TooltipContent>
									<p className="text-[10px]">Select a table and row first</p>
								</TooltipContent>
							)}
						</Tooltip>
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col">
				<div className="flex flex-1 flex-col">
					{viewMode === "results" ? (
						<div className="flex flex-1 flex-col overflow-auto">
							<div className="flex-shrink-0 border-border border-b px-4 py-2">
								<button
									type="button"
									onClick={handleBackToBrowse}
									className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
								>
									← Back to browse
								</button>
							</div>

							{checkAccessMutation.error && (
								<div className="flex-1 p-4">
									<ApiErrorCard
										error={checkAccessMutation.error}
										retry={handleCheckAccess}
										endpoint="/api/row-access/checkAccess"
									/>
								</div>
							)}

							{checkAccessMutation.data && (
								<div className="flex-1 overflow-auto p-4">
									<div className="mb-4 space-y-2">
										<div className="rounded border border-border bg-muted/20 p-3">
											<div className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
												Row Snapshot
											</div>
											<code className="font-mono text-xs">
												{formatRowSummary(
													checkAccessMutation.data.rowSnapshot,
													rowsQuery.data?.columns || [],
												)}
											</code>
										</div>
										<div className="text-[10px] text-muted-foreground">
											Checked{" "}
											{formatTimestamp(checkAccessMutation.data.checkedAt)}
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
													canAccessData.map((item) => (
														<div
															key={item.role}
															className="flex items-center gap-2 py-1"
														>
															<User className="size-3 text-muted-foreground" />
															<span className="font-mono text-xs">
																{item.role}
															</span>
															{item.attributes.superuser && (
																<span className="rounded bg-purple-500/20 px-1 py-0.5 text-[9px] text-purple-400">
																	SU
																</span>
															)}
															{item.attributes.bypassRls && (
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
													cannotAccessData.map((item) => (
														<div
															key={item.role}
															className="flex items-center gap-2 py-1"
														>
															<User className="size-3 text-muted-foreground" />
															<span className="font-mono text-xs">
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

									<div className="mt-4 flex gap-4 text-[11px]">
										{firstCanAccessRole && (
											<button
												type="button"
												onClick={() =>
													navigate(
														`/simulate?role=${encodeURIComponent(firstCanAccessRole)}&table=${encodeURIComponent(selectedTable)}`,
													)
												}
												className="text-primary hover:underline"
											>
												Simulate as {firstCanAccessRole} →
											</button>
										)}
										<button
											type="button"
											onClick={() =>
												navigate(
													`/explore/policies?table=${encodeURIComponent(selectedTable)}`,
												)
											}
											className="text-primary hover:underline"
										>
											View policies for this table →
										</button>
									</div>
								</div>
							)}
						</div>
					) : (
						<>
							<div className="flex flex-shrink-0 items-center justify-between border-border border-b px-4 py-2">
								<div className="flex items-center gap-2">
									{schema && table ? (
										<>
											<span className="font-mono text-xs">{selectedTable}</span>
											<span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
												{rowsQuery.data?.rows.length || 0} rows (browsing)
											</span>
										</>
									) : (
										<span className="text-muted-foreground text-xs">
											Select a table
										</span>
									)}
								</div>
							</div>

							<div className="flex-1 overflow-auto">
								{!schema && !table && (
									<div className="flex h-full items-center justify-center">
										<div className="flex flex-col items-center gap-2 text-center">
											<Shield className="size-10 text-zinc-700" />
											<p className="text-sm text-zinc-500">
												Select a table to get started
											</p>
										</div>
									</div>
								)}

								{checkAccessMutation.isPending && rowsQuery.data && (
									<div className="relative">
										<div className="pointer-events-none opacity-50">
											<div className="overflow-x-auto">
												<table className="border-collapse">
													<thead>
														<tr>
															{rowsQuery.data.columns.map((col) => (
																<th
																	key={col}
																	className="border-border border-b bg-card px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
																>
																	{col}
																</th>
															))}
														</tr>
													</thead>
													<tbody>
														{rowsQuery.data.rows.map((row, i) => (
															<tr key={i} className="hover:bg-white/5">
																{rowsQuery.data.columns.map((col) => (
																	<td
																		key={col}
																		className="border-border border-b px-3 py-1.5 font-mono text-[11px]"
																	>
																		<CellRenderer
																			value={row[col]}
																			allColumnValues={rowsQuery.data.columns.map(
																				(c) => row[c],
																			)}
																		/>
																	</td>
																))}
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="flex flex-col items-center gap-2 rounded-md bg-background/90 p-4 backdrop-blur">
												<div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
												<p className="text-xs">
													Checking access across all roles...
												</p>
												<p className="text-[10px] text-muted-foreground">
													This checks each role individually and may take a
													moment
												</p>
											</div>
										</div>
									</div>
								)}

								{rowsQuery.isLoading && (
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

								{rowsQuery.error && (
									<div className="flex h-full items-center justify-center p-4">
										<ApiErrorCard
											error={rowsQuery.error}
											retry={() => rowsQuery.refetch()}
											endpoint="/api/row-access/getRows"
										/>
									</div>
								)}

								{rowsQuery.data &&
									rowsQuery.data.rows.length > 0 &&
									!checkAccessMutation.isPending && (
										<div className="relative">
											<div className="overflow-x-auto">
												<table className="border-collapse">
													<thead>
														<tr>
															{rowsQuery.data.columns.map((col) => (
																<th
																	key={col}
																	className="border-border border-b bg-card px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
																>
																	{col}
																</th>
															))}
															<th 														className="w-10 border-border border-b bg-card" />
														</tr>
													</thead>
													<tbody>
														{rowsQuery.data.rows.map((row, i) => {
															const isSelected =
																selectedRow &&
																rowsQuery.data?.primaryKeys.every(
																	(pk) => row[pk] === selectedRow[pk],
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
																	{rowsQuery.data.columns.map((col) => (
																		<td
																			key={col}
																			className="border-border border-b px-3 py-1.5 font-mono text-[11px]"
																		>
																			<CellRenderer
																				value={row[col]}
																				allColumnValues={rowsQuery.data.columns.map(
																					(c) => row[c],
																				)}
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
																			<Copy className="size-3 text-muted-foreground hover:text-foreground" />
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

								{rowsQuery.data &&
									rowsQuery.data.rows.length === 0 &&
									!rowsQuery.isLoading && (
										<div className="flex h-full items-center justify-center">
											<div className="text-muted-foreground text-xs">
												No rows in this table
											</div>
										</div>
									)}
							</div>

							{rowsQuery.data && rowsQuery.data.rows.length > 0 && (
								<div className="flex h-7 flex-shrink-0 items-center border-border border-t bg-card px-3">
									<div className="text-[11px] text-muted-foreground">
										Click a row to select it, then hit Check Access
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
