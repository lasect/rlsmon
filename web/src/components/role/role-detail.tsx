import { Crown, LayoutGrid, LogIn, Play, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InheritanceTree } from "@/components/role/inheritance-tree";
import { RolePermissionsHeatmap } from "@/components/role/permissions-heatmap";
import { RolePoliciesList } from "@/components/role/policies-list";
import { RiskIndicators } from "@/components/role/risk-indicators";
import { RoleAttributes } from "@/components/role/role-attributes";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoleInfo } from "@/types/roles";

interface AccessCell {
	tableSchema: string;
	tableName: string;
	role: string;
	select: boolean;
	insert: boolean;
	update: boolean;
	delete: boolean;
}

interface Policy {
	name: string;
	schema: string;
	table: string;
	command: string;
	roles: string[];
	using?: string | null;
	withCheck?: string | null;
}

interface TabData<T> {
	data: T | undefined;
	isLoading: boolean;
}

interface RoleDetailProps {
	role: RoleInfo;
	allRoles: RoleInfo[];
	activeTab: string;
	onTabChange: (tab: string) => void;
	matrix: TabData<AccessCell[]>;
	policies: TabData<Policy[]>;
	onSelect: (name: string) => void;
}

export function RoleDetail({
	role,
	allRoles,
	activeTab,
	onTabChange,
	matrix,
	policies,
	onSelect,
}: RoleDetailProps) {
	const navigate = useNavigate();
	const membersOf = allRoles.filter((r) => r.memberOf.includes(role.name));

	return (
		<div className="flex h-full flex-col">
			<div className="flex-shrink-0 px-4 pt-3 pb-0">
				<div className="mb-1 flex items-center gap-2">
					<Users className="size-4 text-muted-foreground" />
					<code className="font-mono font-semibold text-sm">{role.name}</code>
					{role.isSuperuser && (
						<span className="flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-0.5 font-medium text-[10px] text-yellow-500">
							<Crown className="size-3" />
							Superuser
						</span>
					)}
					{role.canLogin && (
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
				<Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
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
								<RoleAttributes role={role} />
							</div>

							<div className="space-y-2">
								<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									Inheritance
								</div>
								<InheritanceTree
									role={role}
									allRoles={allRoles}
									onSelect={onSelect}
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
												onClick={() => onSelect(child.name)}
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
								<RiskIndicators role={role} allRoles={allRoles} />
							</div>
						</div>
					</TabsContent>

					<TabsContent value="permissions">
						{matrix.isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="text-muted-foreground text-xs">
									Loading permissions...
								</div>
							</div>
						) : (
							<RolePermissionsHeatmap role={role} matrix={matrix.data ?? []} />
						)}
					</TabsContent>

					<TabsContent value="policies">
						{policies.isLoading ? (
							<div className="flex items-center justify-center py-8">
								<div className="text-muted-foreground text-xs">
									Loading policies...
								</div>
							</div>
						) : (
							<RolePoliciesList role={role} policies={policies.data ?? []} />
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
