import {
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Plus,
	Shield,
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

type RowMode = "browse" | "manual";

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
	const [rowMode, setRowMode] = useState<RowMode>("browse");
	const [manualPkValues, setManualPkValues] = useState<Record<string, string>>(
		{},
	);
	const [jwtClaims, setJwtClaims] = useState<JwtClaim[]>([
		{ key: "", value: "" },
	]);
	const [showJwt, setShowJwt] = useState(false);
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
		if (rowsQuery.data && rowsQuery.data.primaryKeys.length > 0) {
			const pkValues: Record<string, string> = {};
			for (const pk of rowsQuery.data.primaryKeys) {
				const val = rowsQuery.data.rows[0]?.[pk];
				pkValues[pk] = val !== undefined ? String(val) : "";
			}
			setManualPkValues(pkValues);
		}
	}, [rowsQuery.data]);

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
		if (rowMode === "browse") {
			return !!selectedRow;
		}
		if (rowMode === "manual") {
			const pks = rowsQuery.data?.primaryKeys || [];
			return pks.every((pk) => manualPkValues[pk]?.trim());
		}
		return false;
	}, [schema, table, rowMode, selectedRow, manualPkValues, rowsQuery.data]);

	const handleSelectRow = (row: Record<string, unknown>) => {
		setSelectedRow(row);
		setViewMode("browse");
	};

	const handleCheckAccess = () => {
		if (!schema || !table) return;

		const pkValues: Record<string, unknown> = {};

		if (rowMode === "browse" && selectedRow) {
			const pkCols = rowsQuery.data?.primaryKeys || [];
			for (const pk of pkCols) {
				pkValues[pk] = selectedRow[pk];
			}
		} else {
			for (const [key, value] of Object.entries(manualPkValues)) {
				if (value.trim()) {
					const numVal = Number(value);
					pkValues[key] = isNaN(numVal) ? value : numVal;
				}
			}
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

	const firstCanAccessRole = checkAccessMutation.data?.canAccess[0]?.role;

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
								<div className="flex items-center justify-between">
									<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Row
									</span>
									<div className="flex gap-1">
										<button
											type="button"
											onClick={() => setRowMode("browse")}
											className={cn(
												"rounded px-1.5 py-0.5 text-[10px] transition-colors",
												rowMode === "browse"
													? "bg-muted text-foreground"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											Browse
										</button>
										<button
											type="button"
											onClick={() => setRowMode("manual")}
											className={cn(
												"rounded px-1.5 py-0.5 text-[10px] transition-colors",
												rowMode === "manual"
													? "bg-muted text-foreground"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											Manual
										</button>
									</div>
								</div>

								{rowMode === "browse" && (
									<div className="space-y-1">
										{rowsQuery.isLoading ? (
											<div className="space-y-1">
												{[1, 2, 3].map((i) => (
													<div
														key={i}
														className="h-8 animate-pulse rounded bg-white/5"
													/>
												))}
											</div>
										) : rowsQuery.data?.rows.length === 0 ? (
											<div className="py-2 text-muted-foreground text-xs">
												No rows in table
											</div>
										) : (
											<div className="max-h-[200px] space-y-0.5 overflow-y-auto rounded border border-border bg-muted/20">
												{rowsQuery.data?.rows.slice(0, 50).map((row, i) => {
													const isSelected =
														selectedRow &&
														rowsQuery.data?.primaryKeys.every(
															(pk) => row[pk] === selectedRow[pk],
														);
													const displayCols = rowsQuery.data!.columns.slice(
														0,
														3,
													);
													return (
														<button
															type="button"
															key={i}
															onClick={() => handleSelectRow(row)}
															className={cn(
																"flex w-full items-center gap-2 px-2 py-1 text-left text-[10px] transition-colors",
																isSelected
																	? "border-l-2 border-l-primary bg-primary/10"
																	: "hover:bg-white/5",
															)}
														>
															{isSelected && (
																<Check className="size-3 text-primary" />
															)}
															{displayCols.map((col) => (
																<span
																	key={col}
																	className="truncate font-mono text-[10px]"
																>
																	{truncate(row[col], 10)}
																</span>
															))}
														</button>
													);
												})}
											</div>
										)}
									</div>
								)}

								{rowMode === "manual" && (
									<div className="space-y-1">
										{rowsQuery.data?.primaryKeys.map((pk) => (
											<div key={pk}>
												<label className="text-[9px] text-muted-foreground uppercase">
													{pk}
												</label>
												<input
													type="text"
													value={manualPkValues[pk] || ""}
													onChange={(e) =>
														setManualPkValues({
															...manualPkValues,
															[pk]: e.target.value,
														})
													}
													placeholder="uuid"
													className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-[11px] placeholder:text-muted-foreground focus:border-primary focus:outline-none"
												/>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="border-white/5 border-b" />

							<div className="space-y-2">
								<button
									type="button"
									onClick={() => setShowJwt(!showJwt)}
									className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground"
								>
									{showJwt ? (
										<ChevronUp className="size-3" />
									) : (
										<ChevronDown className="size-3" />
									)}
									JWT Claims
									<span className="text-[9px] normal-case">(optional)</span>
								</button>

								{showJwt && (
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
											className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
										>
											<Plus className="size-3" />
											Add Claim
										</button>
									</div>
								)}
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
												{checkAccessMutation.data.canAccess.length}
											</span>
										</div>
										<div className="space-y-1 border-l-2 border-l-green-500/30 pl-3">
											{checkAccessMutation.data.canAccess.length === 0 ? (
												<div className="py-2 text-muted-foreground text-xs">
													No roles can access this row
												</div>
											) : (
												checkAccessMutation.data.canAccess.map((item) => (
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
											<span className="font-medium text-sm">Cannot access</span>
											<span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
												{checkAccessMutation.data.cannotAccess.length}
											</span>
										</div>
										<div className="space-y-1 border-l-2 border-l-red-500/30 pl-3">
											{checkAccessMutation.data.cannotAccess.length === 0 ? (
												<div className="py-2 text-muted-foreground text-xs">
													All roles can access this row
												</div>
											) : (
												checkAccessMutation.data.cannotAccess.map((item) => (
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
										<Shield className="size-10 text-muted-foreground/30" />
										<p className="font-medium text-sm">
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
																className="border-border border-b bg-muted/30 px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
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
												This checks each role individually and may take a moment
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
																className="border-border border-b bg-muted/30 px-3 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
															>
																{col}
															</th>
														))}
														<th className="w-10 border-border border-b bg-muted/30" />
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
	);
}
