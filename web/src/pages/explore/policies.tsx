import { Shield, Users } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/api/trpc";
import { CodeBlock } from "@/components/code-block";
import { CommandBadge } from "@/components/command-badge";
import { FilterBar } from "@/components/filter-bar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PolicyGroupBy = "table" | "command" | "none";

export function PoliciesPage() {
	const { data, isLoading, error } = trpc.policies.list.useQuery();
	const [search, setSearch] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const [groupBy, setGroupBy] = useState<PolicyGroupBy>("table");

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">Loading policies...</div>
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
				<div className="text-muted-foreground text-xs">No policies found</div>
			</div>
		);
	}

	const filtered = data.filter((p) => {
		if (!search) return true;
		const s = search.toLowerCase();
		return (
			p.name.toLowerCase().includes(s) ||
			p.table.toLowerCase().includes(s) ||
			p.schema.toLowerCase().includes(s) ||
			p.using?.toLowerCase().includes(s) ||
			p.withCheck?.toLowerCase().includes(s)
		);
	});

	const groups: { key: string; label: string; items: typeof data }[] = [];

	if (groupBy === "table") {
		const tableMap = new Map<string, typeof data>();
		for (const p of filtered) {
			const key = `${p.schema}.${p.table}`;
			if (!tableMap.has(key)) tableMap.set(key, []);
			tableMap.get(key)?.push(p);
		}
		for (const [key, items] of tableMap) {
			groups.push({ key, label: key, items });
		}
	} else if (groupBy === "command") {
		const cmdMap = new Map<string, typeof data>();
		for (const p of filtered) {
			const key = p.command;
			if (!cmdMap.has(key)) cmdMap.set(key, []);
			cmdMap.get(key)?.push(p);
		}
		for (const [key, items] of cmdMap) {
			groups.push({ key, label: key, items });
		}
	} else {
		groups.push({ key: "all", label: "All Policies", items: filtered });
	}

	const selected = data.find((p) => p.name === selectedName) ?? null;

	return (
		<div className="flex h-full">
			<div className="flex w-80 flex-shrink-0 flex-col border-border border-r">
				<div className="flex-shrink-0 px-3 pt-3 pb-2">
					<div className="mb-2">
						<h1 className="font-semibold text-sm">Policies</h1>
						<p className="text-[11px] text-muted-foreground">
							{data.length} polic{data.length !== 1 ? "ies" : "y"}
						</p>
					</div>
					<FilterBar
						search={search}
						onSearchChange={setSearch}
						placeholder="Search policies..."
					/>
					<div className="mt-2 flex gap-1">
						{(
							[
								{ key: "table", label: "By Table" },
								{ key: "command", label: "By Command" },
								{ key: "none", label: "Flat" },
							] as const
						).map((opt) => (
							<button
								key={opt.key}
								type="button"
								onClick={() => setGroupBy(opt.key)}
								className={cn(
									"flex-1 rounded px-2 py-1 font-medium text-[10px] uppercase tracking-wider transition-colors",
									groupBy === opt.key
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted",
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>
				<div className="flex-1 overflow-y-auto px-2 pb-2">
					{groups.map((group) => (
						<div key={group.key} className="mb-2">
							{groupBy !== "none" && (
								<div className="px-2 py-1 font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
									{group.label}
								</div>
							)}
							{group.items.map((policy) => (
								<button
									key={policy.name}
									type="button"
									onClick={() => setSelectedName(policy.name)}
									className={cn(
										"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
										selectedName === policy.name
											? "bg-muted"
											: "hover:bg-muted/50",
									)}
								>
									<div className="flex min-w-0 flex-1 flex-col">
										<code className="truncate font-medium font-mono text-[11px]">
											{policy.name}
										</code>
										<span className="truncate text-[10px] text-muted-foreground">
											{policy.schema}.{policy.table}
										</span>
									</div>
									<CommandBadge command={policy.command} />
								</button>
							))}
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-auto">
				{selected ? (
					<div className="p-4">
						<div className="mb-4">
							<div className="mb-1 flex items-center gap-2">
								<Shield className="size-4 text-muted-foreground" />
								<code className="font-mono font-semibold text-sm">
									{selected.name}
								</code>
								<CommandBadge command={selected.command} />
							</div>
							<div className="text-muted-foreground text-xs">
								<code className="font-mono">
									{selected.schema}.{selected.table}
								</code>
							</div>
						</div>

						<Separator className="mb-4" />

						<div className="space-y-4">
							<div className="space-y-1.5">
								<div className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									<Users className="size-3" />
									Roles
								</div>
								<div className="flex flex-wrap gap-1.5">
									{selected.roles.map((role) => (
										<span
											key={role}
											className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
										>
											{role}
										</span>
									))}
								</div>
							</div>

							{selected.using && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Using
									</div>
									<CodeBlock code={selected.using} />
								</div>
							)}

							{selected.withCheck && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										With Check
									</div>
									<CodeBlock code={selected.withCheck} />
								</div>
							)}

							{selected.permissive && (
								<div className="space-y-1.5">
									<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
										Permissive
									</div>
									<span className="rounded bg-muted px-2 py-0.5 text-[11px]">
										{selected.permissive}
									</span>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<div className="text-center">
							<Shield className="mx-auto mb-2 size-8 text-muted-foreground/30" />
							<div className="text-muted-foreground text-xs">
								Select a policy to inspect
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
