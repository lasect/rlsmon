import { useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { cn } from "@/lib/utils";
import type { RoleInfo } from "@/types/roles";

interface RoleSidebarProps {
	roles: RoleInfo[];
	selectedName: string | null;
	onSelect: (name: string) => void;
}

export function RoleSidebar({
	roles,
	selectedName,
	onSelect,
}: RoleSidebarProps) {
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState({
		superuser: false,
		canLogin: false,
	});

	const superuserCount = roles.filter((r) => r.isSuperuser).length;
	const loginCount = roles.filter((r) => r.canLogin).length;

	const filtered = roles.filter((r) => {
		if (search) {
			const s = search.toLowerCase();
			if (
				!r.name.toLowerCase().includes(s) &&
				!r.memberOf.some((m) => m.toLowerCase().includes(s))
			) {
				return false;
			}
		}
		if (filters.superuser && !r.isSuperuser) return false;
		if (filters.canLogin && !r.canLogin) return false;
		return true;
	});

	return (
		<div className="flex w-64 flex-shrink-0 flex-col border-border border-r">
			<div className="flex-shrink-0 px-3 pt-3 pb-2">
				<div className="mb-2">
					<h1 className="font-semibold text-sm">Roles</h1>
					<p className="text-[11px] text-muted-foreground">
						{filtered.length} role{filtered.length !== 1 ? "s" : ""}
						<span className="text-muted-foreground/50">
							{" · "}
							{superuserCount} superuser{superuserCount !== 1 ? "s" : ""}
							{" · "}
							{loginCount} can login
						</span>
					</p>
				</div>
				<FilterBar
					search={search}
					onSearchChange={setSearch}
					placeholder="Search roles..."
				/>
				<div className="mt-2 flex flex-wrap gap-1">
					<button
						type="button"
						onClick={() =>
							setFilters((f) => ({ ...f, superuser: !f.superuser }))
						}
						className={cn(
							"rounded border px-1.5 py-0.5 text-[10px] transition-colors",
							filters.superuser
								? "border-yellow-500/30 bg-yellow-500/15 text-yellow-500"
								: "border-white/10 text-muted-foreground hover:border-white/30",
						)}
					>
						Superuser
					</button>
					<button
						type="button"
						onClick={() => setFilters((f) => ({ ...f, canLogin: !f.canLogin }))}
						className={cn(
							"rounded border px-1.5 py-0.5 text-[10px] transition-colors",
							filters.canLogin
								? "border-blue-500/30 bg-blue-500/15 text-blue-400"
								: "border-white/10 text-muted-foreground hover:border-white/30",
						)}
					>
						Can Login
					</button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto px-2 pb-2">
				<div className="space-y-0.5">
					{filtered.map((role) => (
						<button
							key={role.name}
							type="button"
							onClick={() => onSelect(role.name)}
							className={cn(
								"flex w-full cursor-pointer items-center gap-2 rounded-md border border-white/5 bg-muted/20 px-3 py-1.5 text-left shadow-sm transition-all",
								selectedName === role.name
									? "border-l-2 border-l-primary bg-primary/5 pl-1.5 shadow-none"
									: "hover:border-white/10 hover:bg-muted/40",
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
	);
}
