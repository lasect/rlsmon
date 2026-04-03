import { cn } from "@/lib/utils";

interface RoleNode {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	memberOf: string[];
}

interface InheritanceTreeProps {
	role: RoleNode;
	allRoles: RoleNode[];
	onSelect: (name: string) => void;
}

export function InheritanceTree({
	role,
	allRoles,
	onSelect,
}: InheritanceTreeProps) {
	const ancestors = buildAncestorChain(role.name, allRoles).reverse();
	const descendants = findDescendants(role.name, allRoles);

	return (
		<div className="space-y-3">
			{ancestors.length > 0 && (
				<div className="space-y-0">
					<div className="mb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						Inherits from
					</div>
					<div className="flex flex-col">
						{ancestors.map((node, i) => (
							<div key={node.name} className="flex items-center">
								<div className="flex w-6 shrink-0 flex-col items-center">
									{i < ancestors.length - 1 && (
										<div className="h-3 w-px bg-border" />
									)}
									{i > 0 && <div className="h-3 w-px bg-border" />}
								</div>
								<div className="flex items-center gap-1.5">
									<div className="h-px w-3 bg-border" />
									<RoleBadge
										name={node.name}
										isSuperuser={node.isSuperuser}
										canLogin={node.canLogin}
										onClick={() => onSelect(node.name)}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="flex items-center gap-2">
				<div className="h-px flex-1 bg-border" />
				<RoleBadge
					name={role.name}
					isSuperuser={role.isSuperuser}
					canLogin={role.canLogin}
					active
					onClick={() => onSelect(role.name)}
				/>
				<div className="h-px flex-1 bg-border" />
			</div>

			{descendants.length > 0 && (
				<div className="space-y-0">
					<div className="mb-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						Inherited by
					</div>
					<div className="flex flex-col">
						{descendants.map((node, i) => (
							<div key={node.name} className="flex items-center">
								<div className="flex w-6 shrink-0 flex-col items-center">
									{i < descendants.length - 1 && (
										<div className="h-3 w-px bg-border" />
									)}
									{i > 0 && <div className="h-3 w-px bg-border" />}
								</div>
								<div className="flex items-center gap-1.5">
									<div className="h-px w-3 bg-border" />
									<RoleBadge
										name={node.name}
										isSuperuser={node.isSuperuser}
										canLogin={node.canLogin}
										onClick={() => onSelect(node.name)}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function buildAncestorChain(
	roleName: string,
	allRoles: RoleNode[],
	visited = new Set<string>(),
): RoleNode[] {
	if (visited.has(roleName)) return [];
	visited.add(roleName);

	const role = allRoles.find((r) => r.name === roleName);
	if (!role || role.memberOf.length === 0) return [];

	const results: RoleNode[] = [];
	for (const parent of role.memberOf) {
		const parentRole = allRoles.find((r) => r.name === parent);
		if (!parentRole) continue;
		results.push(parentRole);
		results.push(...buildAncestorChain(parent, allRoles, visited));
	}
	return results;
}

function findDescendants(roleName: string, allRoles: RoleNode[]): RoleNode[] {
	return allRoles.filter((r) => r.memberOf.includes(roleName));
}

function RoleBadge({
	name,
	isSuperuser,
	canLogin,
	active,
	onClick,
}: {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	active?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
				active
					? "bg-primary/15 font-medium text-primary"
					: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
			)}
		>
			{name}
			{isSuperuser && (
				<span className="rounded bg-yellow-500/20 px-1 py-px font-medium text-[8px] text-yellow-500">
					SU
				</span>
			)}
			{canLogin && (
				<span className="rounded bg-blue-500/20 px-1 py-px font-medium text-[8px] text-blue-400">
					L
				</span>
			)}
		</button>
	);
}
