import { CommandBadge } from "@/components/command-badge";
import { cn } from "@/lib/utils";

interface Policy {
	name: string;
	schema: string;
	table: string;
	command: string;
	roles: string[];
	using?: string | null;
	withCheck?: string | null;
}

interface RoleData {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	memberOf: string[];
}

interface RolePoliciesListProps {
	role: RoleData;
	allRoles: RoleData[];
	policies: Policy[];
}

export function RolePoliciesList({
	role,
	policies,
}: Omit<RolePoliciesListProps, "allRoles">) {
	const effectiveRoles = new Set<string>([
		role.name,
		...role.memberOf,
		"PUBLIC",
	]);

	const relevant = policies.filter((p) =>
		p.roles.some((r) => effectiveRoles.has(r)),
	);

	if (relevant.length === 0) {
		return (
			<div className="text-[11px] text-muted-foreground">
				No policies affect this role.
			</div>
		);
	}

	const byTable = new Map<string, typeof relevant>();
	for (const p of relevant) {
		const key = `${p.schema}.${p.table}`;
		if (!byTable.has(key)) byTable.set(key, []);
		byTable.get(key)?.push(p);
	}

	const appliedRoles = relevant.flatMap((p) =>
		p.roles.filter((r) => effectiveRoles.has(r)),
	);
	const uniqueAppliedRoles = Array.from(new Set(appliedRoles));

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-1.5">
				{uniqueAppliedRoles.map((r) => (
					<span
						key={r}
						className={cn(
							"rounded px-1.5 py-0.5 font-mono text-[10px]",
							r === role.name
								? "bg-primary/15 text-primary"
								: r === "PUBLIC"
									? "bg-muted text-muted-foreground"
									: "bg-muted/60 text-muted-foreground",
						)}
					>
						{r}
						{r !== role.name && (
							<span className="ml-0.5 opacity-60">
								{r === "PUBLIC" ? "" : "(inherited)"}
							</span>
						)}
					</span>
				))}
			</div>

			{Array.from(byTable.entries()).map(([tableKey, tablePolicies]) => (
				<div key={tableKey} className="space-y-1">
					<div className="font-mono text-[10px] text-muted-foreground">
						{tableKey}
					</div>
					<div className="space-y-0.5">
						{tablePolicies.map((policy) => (
							<div
								key={policy.name}
								className="flex items-center gap-2 rounded bg-muted/20 px-2 py-1"
							>
								<code className="truncate font-medium font-mono text-[10px]">
									{policy.name}
								</code>
								<CommandBadge command={policy.command} />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
