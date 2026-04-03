import { Crown, LayoutGrid, LogIn, Play, Shield, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/api/trpc";
import { FilterBar } from "@/components/filter-bar";
import { InheritanceTree } from "@/components/role/inheritance-tree";
import { RolePermissionsHeatmap } from "@/components/role/permissions-heatmap";
import { RolePoliciesList } from "@/components/role/policies-list";
import { RiskIndicators } from "@/components/role/risk-indicators";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function RolesPage() {
	const { data, isLoading, error } = trpc.roles.list.useQuery();
	const matrix = trpc.matrix.get.useQuery().data ?? [];
	const policies = trpc.policies.list.useQuery().data ?? [];
	const [search, setSearch] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const navigate = useNavigate();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">Loading roles...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-destructive text-xs">Error: {error.message}</div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">No roles found</div>
			</div>
		);
	}

	const filtered = data.filter((r) => {
		if (!search) return true;
		const s = search.toLowerCase();
		return (
			r.name.toLowerCase().includes(s) ||
			r.memberOf.some((m) => m.toLowerCase().includes(s))
		);
	});

	const selected = data.find((r) => r.name === selectedName) ?? null;
	const membersOf = selected
		? data.filter((r) => r.memberOf.includes(selected.name))
		: [];

	return (
		<div className="flex h-full">
			<div className="flex w-64 flex-shrink-0 flex-col border-border border-r">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<div className="mb-2">
						<h1 className="font-semibold text-sm">Roles</h1>
						<p className="text-[11px] text-muted-foreground">
							{data.length} role{data.length !== 1 ? "s" : ""}
						</p>
					</div>
					<FilterBar
						search={search}
						onSearchChange={setSearch}
						placeholder="Search roles..."
					/>
				</div>
				<div className="flex-1 overflow-y-auto px-2 pb-2">
					<div className="space-y-px">
						{filtered.map((role) => (
							<button
								key={role.name}
								type="button"
								onClick={() => setSelectedName(role.name)}
								className={cn(
									"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
									selectedName === role.name ? "bg-muted" : "hover:bg-muted/50",
								)}
							>
								<div className="flex min-w-0 flex-1 flex-col">
									<code className="truncate font-medium font-mono text-[11px]">
										{role.name}
									</code>
									{role.memberOf.length > 0 && (
										<span className="truncate text-[10px] text-muted-foreground">
											member of {role.memberOf.join(", ")}
										</span>
									)}
								</div>
								<div className="flex shrink-0 gap-1">
									{role.isSuperuser && (
										<span className="rounded bg-yellow-500/15 px-1.5 py-0.5 font-medium text-[9px] text-yellow-500">
											SU
										</span>
									)}
									{role.canLogin && (
										<span className="rounded bg-blue-500/15 px-1.5 py-0.5 font-medium text-[9px] text-blue-400">
											L
										</span>
									)}
								</div>
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-auto">
				{selected ? (
					<div className="flex h-full flex-col">
						<div className="flex-shrink-0 px-4 pt-3 pb-0">
							<div className="mb-1 flex items-center gap-2">
								<Users className="size-4 text-muted-foreground" />
								<code className="font-mono font-semibold text-sm">
									{selected.name}
								</code>
								{selected.isSuperuser && (
									<span className="flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-0.5 font-medium text-[10px] text-yellow-500">
										<Crown className="size-3" />
										Superuser
									</span>
								)}
								{selected.canLogin && (
									<span className="flex items-center gap-1 rounded bg-blue-500/15 px-2 py-0.5 font-medium text-[10px] text-blue-400">
										<LogIn className="size-3" />
										Can Login
									</span>
								)}
							</div>
							<div className="mt-2 flex items-center gap-2">
								<button
									type="button"
									onClick={() => navigate("/simulate")}
									className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								>
									<Play className="size-3" />
									Simulate
								</button>
								<button
									type="button"
									onClick={() => navigate("/explore/matrix")}
									className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
								>
									<LayoutGrid className="size-3" />
									View in Matrix
								</button>
							</div>
						</div>

						<Separator className="mt-2 mb-0" />

						<div className="flex-1 overflow-y-auto px-4 py-3">
							<Tabs defaultValue="overview" className="w-full">
								<TabsList className="mb-3">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="permissions">Permissions</TabsTrigger>
									<TabsTrigger value="policies">Policies</TabsTrigger>
								</TabsList>

								<TabsContent value="overview">
									<div className="space-y-4">
										<div className="space-y-2">
											<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
												Attributes
											</div>
											<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
												<Attr label="Superuser" value={selected.isSuperuser} />
												<Attr label="Can Login" value={selected.canLogin} />
											</div>
										</div>

										<div className="space-y-2">
											<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
												Inheritance
											</div>
											<InheritanceTree
												role={selected}
												allRoles={data}
												onSelect={setSelectedName}
											/>
										</div>

										{membersOf.length > 0 && (
											<div className="space-y-1.5">
												<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
													Members
												</div>
												<div className="flex flex-wrap gap-1.5">
													{membersOf.map((child) => (
														<button
															key={child.name}
															type="button"
															onClick={() => setSelectedName(child.name)}
															className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-muted/80"
														>
															{child.name}
														</button>
													))}
												</div>
											</div>
										)}

										<div className="space-y-2">
											<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
												Risk Analysis
											</div>
											<RiskIndicators role={selected} allRoles={data} />
										</div>
									</div>
								</TabsContent>

								<TabsContent value="permissions">
									<RolePermissionsHeatmap role={selected} matrix={matrix} />
								</TabsContent>

								<TabsContent value="policies">
									<RolePoliciesList role={selected} policies={policies} />
								</TabsContent>
							</Tabs>
						</div>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<Shield className="mx-auto mb-2 size-8 text-muted-foreground/30" />
							<div className="text-muted-foreground text-xs">
								Select a role to inspect
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function Attr({ label, value }: { label: string; value: boolean | undefined }) {
	return (
		<div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1">
			<span className="text-[11px] text-muted-foreground">{label}</span>
			<span
				className={cn(
					"font-mono text-[11px]",
					value ? "text-rls-grant" : "text-muted-foreground",
				)}
			>
				{value ? "yes" : "no"}
			</span>
		</div>
	);
}
