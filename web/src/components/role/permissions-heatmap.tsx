import { Check, X } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

interface RolePermissionsHeatmapProps {
	role: RoleInfo;
	matrix: AccessCell[];
}

export function RolePermissionsHeatmap({
	role,
	matrix,
}: RolePermissionsHeatmapProps) {
	const effectiveRoles = new Set<string>([
		role.name,
		...role.memberOf,
		"PUBLIC",
	]);

	const tables = Array.from(
		new Set(matrix.map((c) => `${c.tableSchema}.${c.tableName}`)),
	).sort();

	const tablePerms = tables.map((tableKey) => {
		const [schema, table] = tableKey.split(".");
		const matchingCells = matrix.filter(
			(c) =>
				c.tableSchema === schema &&
				c.tableName === table &&
				effectiveRoles.has(c.role),
		);

		const result = {
			tableKey,
			schema,
			table,
			select: false,
			insert: false,
			update: false,
			delete: false,
			grantedBy: [] as string[],
		};

		for (const cell of matchingCells) {
			if (cell.select && !result.select) {
				result.select = true;
				result.grantedBy.push(`${cell.role}:SELECT`);
			}
			if (cell.insert && !result.insert) {
				result.insert = true;
				result.grantedBy.push(`${cell.role}:INSERT`);
			}
			if (cell.update && !result.update) {
				result.update = true;
				result.grantedBy.push(`${cell.role}:UPDATE`);
			}
			if (cell.delete && !result.delete) {
				result.delete = true;
				result.grantedBy.push(`${cell.role}:DELETE`);
			}
		}

		return result;
	});

	const grantCount = tablePerms.reduce(
		(acc, t) =>
			acc + [t.select, t.insert, t.update, t.delete].filter(Boolean).length,
		0,
	);
	const totalCount = tablePerms.length * 4;

	if (tables.length === 0) {
		return (
			<div className="text-[11px] text-muted-foreground">
				No tables found in access matrix.
			</div>
		);
	}

	const OPERATIONS = ["select", "insert", "update", "delete"] as const;
	const OP_LABELS: Record<string, string> = {
		select: "SELECT",
		insert: "INSERT",
		update: "UPDATE",
		delete: "DELETE",
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
					Effective permissions
				</div>
				<div className="text-[10px] text-muted-foreground">
					{grantCount}/{totalCount} granted
				</div>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full border-collapse">
					<thead>
						<tr>
							<th className="sticky left-0 z-10 w-28 border-border border-b bg-background px-2 py-1 text-left font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Table
							</th>
							{OPERATIONS.map((op) => (
								<th
									key={op}
									className="min-w-[56px] border-border border-b px-2 py-1 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
								>
									{op.slice(0, 1).toUpperCase()}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{tablePerms.map((tp) => (
							<tr key={tp.tableKey}>
								<td className="sticky left-0 z-10 bg-background px-2 py-0.5">
									<code className="font-mono text-[10px]">{tp.table}</code>
								</td>
								{OPERATIONS.map((op) => {
									const allowed = tp[op];
									return (
										<td key={op} className="px-1 py-0.5 text-center">
											<Tooltip>
												<TooltipTrigger asChild>
													<div
														className={cn(
															"inline-flex size-5 cursor-default items-center justify-center rounded text-[10px]",
															allowed
																? "bg-rls-grant-muted/30 text-rls-grant"
																: "bg-rls-deny-muted/20 text-rls-deny-muted",
														)}
													>
														{allowed ? (
															<Check className="size-3" />
														) : (
															<X className="size-3" />
														)}
													</div>
												</TooltipTrigger>
												<TooltipContent side="top" className="text-[11px]">
													<div className="flex flex-col gap-0.5">
														<span className="font-medium">
															{OP_LABELS[op]} on {tp.schema}.{tp.table}
														</span>
														<span className="text-foreground/60">
															{allowed ? "Allowed" : "Denied"}
														</span>
														{allowed && tp.grantedBy.length > 0 && (
															<span className="text-foreground/50">
																via {tp.grantedBy.join(", ")}
															</span>
														)}
													</div>
												</TooltipContent>
											</Tooltip>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
