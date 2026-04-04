import { Check, LayoutGrid, List, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { CommandBadge } from "@/components/command-badge";
import { FilterBar } from "@/components/filter-bar";
import { SlideOver } from "@/components/slide-over";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MatrixFilter = "all" | "grants" | "denies" | "risky";
type MatrixView = "grid" | "list";

export function MatrixPage() {
	const { data, isLoading, error, refetch } = trpc.matrix.get.useQuery();
	const { data: policiesData } = trpc.policies.list.useQuery();
	const rolesData = trpc.roles.list.useQuery().data;
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<MatrixFilter>("all");
	const [view, setView] = useState<MatrixView>("grid");
	const [selectedCell, setSelectedCell] = useState<{
		tableSchema: string;
		tableName: string;
		role: string;
		op: string;
		allowed: boolean;
	} | null>(null);
	const [hoveredRole, setHoveredRole] = useState<string | null>(null);
	const navigate = useNavigate();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">
					Loading access matrix...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<ApiErrorCard
				error={error}
				retry={() => refetch()}
				endpoint="/api/matrix"
			/>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">No data available</div>
			</div>
		);
	}

	const tables = Array.from(
		new Set(data.map((cell) => `${cell.tableSchema}.${cell.tableName}`)),
	).sort();
	const ops = ["select", "insert", "update", "delete"] as const;

	const roleAccessCounts = data.reduce(
		(acc, cell) => {
			if (!acc[cell.role]) acc[cell.role] = 0;
			acc[cell.role] += [
				cell.select,
				cell.insert,
				cell.update,
				cell.delete,
			].filter(Boolean).length;
			return acc;
		},
		{} as Record<string, number>,
	);

	const roles = Array.from(new Set(data.map((cell) => cell.role))).sort(
		(a, b) => {
			const aCount = roleAccessCounts[a] ?? 0;
			const bCount = roleAccessCounts[b] ?? 0;
			if (bCount !== aCount) return bCount - aCount;
			return a.localeCompare(b);
		},
	);

	const totalGrants = data.reduce(
		(acc, cell) =>
			acc +
			[cell.select, cell.insert, cell.update, cell.delete].filter(Boolean)
				.length,
		0,
	);
	const totalOps = data.length * 4;
	const totalDenies = totalOps - totalGrants;

	const loginRoles = new Set(
		rolesData?.filter((r) => r.canLogin).map((r) => r.name) ?? [],
	);
	const inheritedLoginRoles = new Set(
		rolesData
			?.filter((r) => !r.canLogin && r.memberOf.some((m) => loginRoles.has(m)))
			.map((r) => r.name) ?? [],
	);
	const effectiveLogin = new Set([...loginRoles, ...inheritedLoginRoles]);

	const riskyCount = data.reduce((acc, cell) => {
		if (!effectiveLogin.has(cell.role)) return acc;
		return (
			acc +
			[cell.select, cell.insert, cell.update, cell.delete].filter(Boolean)
				.length
		);
	}, 0);

	const filteredTables = tables.filter((t) => {
		if (!search) return true;
		const s = search.toLowerCase();
		return (
			t.toLowerCase().includes(s) ||
			roles.some((r) => r.toLowerCase().includes(s))
		);
	});

	const filteredRoles = roles.filter((r) => {
		if (!search) return true;
		const s = search.toLowerCase();
		return (
			r.toLowerCase().includes(s) ||
			filteredTables.some((t) => t.toLowerCase().includes(s))
		);
	});

	const getCell = (tableKey: string, role: string) => {
		const [schema, table] = tableKey.split(".");
		return data.find(
			(c) =>
				c.tableSchema === schema && c.tableName === table && c.role === role,
		);
	};

	const getOpValue = (cell: (typeof data)[number] | undefined, op: string) => {
		if (!cell) return false;
		return cell[op as keyof typeof cell] as boolean;
	};

	const isRisky = (role: string, allowed: boolean) => {
		if (!allowed) return false;
		return effectiveLogin.has(role);
	};

	const showCell = (role: string, allowed: boolean) => {
		if (filter === "all") return true;
		if (filter === "grants") return allowed;
		if (filter === "denies") return !allowed;
		if (filter === "risky") return isRisky(role, allowed);
		return true;
	};

	const cellDetail = selectedCell
		? data.filter(
				(c) =>
					c.tableSchema === selectedCell.tableSchema &&
					c.tableName === selectedCell.tableName &&
					c.role === selectedCell.role,
			)[0]
		: null;

	const policies = policiesData ?? [];
	const relevantPolicies = cellDetail
		? policies.filter(
				(p) =>
					p.schema === cellDetail.tableSchema &&
					p.table === cellDetail.tableName &&
					(p.roles.includes("PUBLIC") || p.roles.includes(cellDetail.role)),
			)
		: [];

	const getTableGrantCount = (tableKey: string) => {
		const [schema, table] = tableKey.split(".");
		return data
			.filter((c) => c.tableSchema === schema && c.tableName === table)
			.reduce(
				(acc, c) =>
					acc + [c.select, c.insert, c.update, c.delete].filter(Boolean).length,
				0,
			);
	};

	const getTableMaxGrants = () => {
		return roles.length * 4;
	};

	if (view === "list") {
		return (
			<div className="flex h-full flex-col">
				<div className="flex-shrink-0 px-4 pt-3 pb-2">
					<div className="mb-2 flex items-center justify-between">
						<div>
							<h1 className="font-semibold text-sm">Access Matrix</h1>
							<p className="text-[11px] text-muted-foreground">
								{roles.length} roles · {tables.length} tables · {totalGrants}{" "}
								grants · {totalDenies} denies
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setView("grid")}
								className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								<LayoutGrid className="size-3" />
								Grid
							</button>
							<FilterBar
								search={search}
								onSearchChange={setSearch}
								placeholder="Filter tables or roles..."
								toggles={[
									{
										label: "All",
										active: filter === "all",
										onToggle: () => setFilter("all"),
									},
									{
										label: "Grants",
										active: filter === "grants",
										onToggle: () => setFilter("grants"),
									},
									{
										label: "Denies",
										active: filter === "denies",
										onToggle: () => setFilter("denies"),
									},
								]}
							/>
						</div>
					</div>
				</div>
				<div className="flex-1 overflow-auto px-4 pb-3">
					{filteredTables.map((tableKey) => {
						const visibleRoles = roles.filter((role) => {
							return ops.some((op) => {
								const cell = getCell(tableKey, role);
								const val = getOpValue(cell, op);
								return showCell(role, val);
							});
						});

						if (visibleRoles.length === 0) return null;

						const [schema, table] = tableKey.split(".");

						return (
							<div key={tableKey} className="mb-3">
								<div className="sticky top-0 z-10 mb-1 flex items-center gap-2 border-border border-b bg-background/95 px-2 py-1 backdrop-blur">
									<code className="font-medium font-mono text-[11px]">
										{schema}.{table}
									</code>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full border-collapse">
										<thead>
											<tr>
												<th className="sticky left-0 z-10 w-32 border-border border-b bg-background px-2 py-1 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
													Role
												</th>
												{ops.map((op) => (
													<th
														key={op}
														className="min-w-[52px] border-border border-b px-2 py-1 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
													>
														{op}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{visibleRoles.map((role) => {
												const rowCells = ops.map((op) => {
													const cell = getCell(tableKey, role);
													return {
														op,
														allowed: getOpValue(cell, op),
														cell,
													};
												});

												const anyVisible = rowCells.some(({ allowed }) =>
													showCell(role, allowed),
												);
												if (!anyVisible) return null;

												return (
													<tr key={role} className="group/row">
														<td className="sticky left-0 z-10 bg-background px-2 py-0.5">
															<code className="font-mono text-[11px]">
																{role}
															</code>
														</td>
														{rowCells.map(({ op, allowed }) => {
															if (!showCell(role, allowed)) {
																return <td key={op} className="hidden" />;
															}
															return (
																<td
																	key={op}
																	className="px-1 py-0.5 text-center"
																>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<button
																				type="button"
																				onClick={() =>
																					setSelectedCell({
																						tableSchema: schema,
																						tableName: table,
																						role,
																						op,
																						allowed,
																					})
																				}
																				className={cn(
																					"inline-flex size-5 cursor-default items-center justify-center rounded text-[10px] transition-colors",
																					allowed
																						? "bg-rls-grant-muted/30 text-rls-grant hover:bg-rls-grant-muted/50"
																						: "bg-rls-deny-muted/30 text-rls-deny-muted hover:bg-rls-deny-muted/50",
																				)}
																			>
																				{allowed ? (
																					<Check className="size-3" />
																				) : (
																					<X className="size-3" />
																				)}
																			</button>
																		</TooltipTrigger>
																		<TooltipContent
																			side="top"
																			className="text-[11px]"
																		>
																			<div className="flex flex-col gap-0.5">
																				<span className="font-medium">
																					{role} → {op.toUpperCase()} on{" "}
																					{schema}.{table}
																				</span>
																				<span className="text-foreground/60">
																					{allowed ? "Allowed" : "Denied"}
																				</span>
																			</div>
																		</TooltipContent>
																	</Tooltip>
																</td>
															);
														})}
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						);
					})}
				</div>

				<SlideOver
					open={!!selectedCell}
					onClose={() => setSelectedCell(null)}
					title={
						selectedCell
							? `${selectedCell.role} → ${selectedCell.op.toUpperCase()}`
							: ""
					}
				>
					{selectedCell && cellDetail && (
						<div className="space-y-4">
							<div className="space-y-2">
								<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Target
								</div>
								<code className="font-mono text-xs">
									{cellDetail.tableSchema}.{cellDetail.tableName}
								</code>
							</div>

							<div className="space-y-2">
								<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Access
								</div>
								<div className="flex items-center gap-2">
									<div
										className={cn(
											"flex items-center gap-1.5 rounded px-2 py-1 font-medium text-xs",
											selectedCell.allowed
												? "bg-rls-grant-muted/30 text-rls-grant"
												: "bg-rls-deny-muted/30 text-rls-deny-muted",
										)}
									>
										{selectedCell.allowed ? (
											<Check className="size-3" />
										) : (
											<X className="size-3" />
										)}
										{selectedCell.allowed ? "GRANTED" : "DENIED"}
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Governing Policies
								</div>
								{relevantPolicies.length === 0 ? (
									<div className="text-muted-foreground text-xs">
										{selectedCell.allowed
											? "No specific policies — access allowed by default (RLS not enforced)"
											: "No matching policies found"}
									</div>
								) : (
									<div className="space-y-2">
										{relevantPolicies.map((policy) => (
											<div
												key={policy.name}
												className="rounded-md border bg-muted/20 p-2.5"
											>
												<div className="mb-1.5 flex items-center justify-between">
													<code className="font-medium font-mono text-xs">
														{policy.name}
													</code>
													<CommandBadge command={policy.command} />
												</div>
												<div className="mb-1.5 text-[11px] text-muted-foreground">
													Roles: {policy.roles.join(", ")}
												</div>
												{policy.using && (
													<div className="mt-1.5">
														<div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
															Using
														</div>
														<code className="block break-all rounded bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
															{policy.using}
														</code>
													</div>
												)}
												{policy.withCheck && (
													<div className="mt-1.5">
														<div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
															With Check
														</div>
														<code className="block break-all rounded bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
															{policy.withCheck}
														</code>
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					)}
				</SlideOver>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex-shrink-0 px-4 pt-3 pb-2">
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-baseline gap-3">
						<div>
							<h1 className="font-semibold text-sm">Access Matrix</h1>
							<p className="text-[11px] text-muted-foreground">
								{roles.length} roles · {tables.length} tables · {totalGrants}{" "}
								grants · {totalDenies} denies
								{riskyCount > 0 && (
									<>
										{" "}
										·{" "}
										<span className="text-rls-warning">{riskyCount} risky</span>
									</>
								)}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setView("list")}
							className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<List className="size-3" />
							List
						</button>
						<FilterBar
							search={search}
							onSearchChange={setSearch}
							placeholder="Filter tables or roles..."
							toggles={[
								{
									label: "All",
									active: filter === "all",
									onToggle: () => setFilter("all"),
								},
								{
									label: "Grants",
									active: filter === "grants",
									onToggle: () => setFilter("grants"),
								},
								{
									label: "Denies",
									active: filter === "denies",
									onToggle: () => setFilter("denies"),
								},
								{
									label: "Risky",
									active: filter === "risky",
									onToggle: () => setFilter("risky"),
								},
							]}
						/>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto px-4 pb-3">
				<div className="overflow-x-auto">
					<table className="border-collapse">
						<thead>
							<tr>
								<th className="sticky left-0 z-20 w-32 border-border border-b bg-background px-2 py-1.5 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Role
								</th>
								{filteredTables.map((tableKey) => {
									const grantCount = getTableGrantCount(tableKey);
									const maxGrants = getTableMaxGrants();
									const isFullAccess = grantCount === maxGrants;
									return (
										<th
											key={tableKey}
											className="border-border border-b px-1 py-1.5 text-center"
											colSpan={4}
										>
											<div className="flex flex-col items-center gap-0.5">
												<button
													type="button"
													onClick={() => {
														const [, table] = tableKey.split(".");
														setSearch(table);
													}}
													className={cn(
														"font-medium font-mono text-[10px] transition-colors hover:text-foreground",
														isFullAccess
															? "text-rls-grant"
															: "text-muted-foreground",
													)}
												>
													{tableKey}
												</button>
												<div className="flex gap-0.5">
													{ops.map((op) => (
														<div
															key={op}
															className="w-3.5 text-[8px] text-muted-foreground/50 uppercase"
														>
															{op[0]}
														</div>
													))}
												</div>
											</div>
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody>
							{filteredRoles.map((role) => {
								const isLogin = effectiveLogin.has(role);

								const rowHasVisibleCells = filteredTables.some((tableKey) => {
									const cell = getCell(tableKey, role);
									return ops.some((op) => {
										const allowed = getOpValue(cell, op);
										return showCell(role, allowed);
									});
								});

								if (!rowHasVisibleCells) return null;

								return (
									<tr
										key={role}
										className={cn(
											"transition-colors",
											hoveredRole === role
												? "bg-muted/30"
												: hoveredRole
													? "opacity-40"
													: "",
										)}
										onMouseEnter={() => setHoveredRole(role)}
										onMouseLeave={() => setHoveredRole(null)}
									>
										<td className="sticky left-0 z-10 bg-background px-2 py-0.5">
											<div className="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => navigate("/explore/roles")}
													className="group/role font-mono text-[11px] transition-colors hover:text-primary"
												>
													{role}
												</button>
												{isLogin && (
													<span className="size-1.5 rounded-full bg-blue-400/60" />
												)}
											</div>
										</td>
										{filteredTables.map((tableKey) => {
											const [schema, table] = tableKey.split(".");
											const cell = getCell(tableKey, role);

											return (
												<td key={tableKey} className="px-1 py-0.5">
													<div className="flex justify-center gap-0.5">
														{ops.map((op) => {
															const allowed = getOpValue(cell, op);
															const risky = isRisky(role, allowed);

															if (!showCell(role, allowed)) {
																return <div key={op} className="size-3.5" />;
															}

															return (
																<Tooltip key={op}>
																	<TooltipTrigger asChild>
																		<button
																			type="button"
																			onClick={() =>
																				setSelectedCell({
																					tableSchema: schema,
																					tableName: table,
																					role,
																					op,
																					allowed,
																				})
																			}
																			className={cn(
																				"size-3.5 cursor-default rounded-sm transition-all",
																				allowed
																					? cn(
																							"bg-rls-grant/70 hover:bg-rls-grant",
																							risky &&
																								"ring-1 ring-rls-warning/50",
																						)
																					: "bg-rls-deny-muted/20 hover:bg-rls-deny-muted/40",
																			)}
																		/>
																	</TooltipTrigger>
																	<TooltipContent
																		side="top"
																		className="text-[11px]"
																	>
																		<div className="flex flex-col gap-0.5">
																			<span className="font-medium">
																				{role} → {op.toUpperCase()} on {schema}.
																				{table}
																			</span>
																			<span className="text-foreground/60">
																				{allowed ? "Allowed" : "Denied"}
																			</span>
																			{risky && (
																				<span className="text-rls-warning">
																					Risky: role can login
																				</span>
																			)}
																		</div>
																	</TooltipContent>
																</Tooltip>
															);
														})}
													</div>
												</td>
											);
										})}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<SlideOver
				open={!!selectedCell}
				onClose={() => setSelectedCell(null)}
				title={
					selectedCell
						? `${selectedCell.role} → ${selectedCell.op.toUpperCase()}`
						: ""
				}
			>
				{selectedCell && cellDetail && (
					<div className="space-y-4">
						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Target
							</div>
							<code className="font-mono text-xs">
								{cellDetail.tableSchema}.{cellDetail.tableName}
							</code>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Access
							</div>
							<div className="flex items-center gap-2">
								<div
									className={cn(
										"flex items-center gap-1.5 rounded px-2 py-1 font-medium text-xs",
										selectedCell.allowed
											? "bg-rls-grant-muted/30 text-rls-grant"
											: "bg-rls-deny-muted/30 text-rls-deny-muted",
									)}
								>
									{selectedCell.allowed ? (
										<Check className="size-3" />
									) : (
										<X className="size-3" />
									)}
									{selectedCell.allowed ? "GRANTED" : "DENIED"}
								</div>
								{isRisky(selectedCell.role, selectedCell.allowed) && (
									<span className="rounded bg-rls-warning-muted/30 px-2 py-1 font-medium text-[10px] text-rls-warning">
										Risky
									</span>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Governing Policies
							</div>
							{relevantPolicies.length === 0 ? (
								<div className="text-muted-foreground text-xs">
									{selectedCell.allowed
										? "No specific policies — access allowed by default (RLS not enforced)"
										: "No matching policies found"}
								</div>
							) : (
								<div className="space-y-2">
									{relevantPolicies.map((policy) => (
										<div
											key={policy.name}
											className="rounded-md border bg-muted/20 p-2.5"
										>
											<div className="mb-1.5 flex items-center justify-between">
												<code className="font-medium font-mono text-xs">
													{policy.name}
												</code>
												<CommandBadge command={policy.command} />
											</div>
											<div className="mb-1.5 text-[11px] text-muted-foreground">
												Roles: {policy.roles.join(", ")}
											</div>
											{policy.using && (
												<div className="mt-1.5">
													<div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
														Using
													</div>
													<code className="block break-all rounded bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
														{policy.using}
													</code>
												</div>
											)}
											{policy.withCheck && (
												<div className="mt-1.5">
													<div className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
														With Check
													</div>
													<code className="block break-all rounded bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
														{policy.withCheck}
													</code>
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</SlideOver>
		</div>
	);
}
