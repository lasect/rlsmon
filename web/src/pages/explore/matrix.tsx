import { trpc } from "@/api/trpc";

export function MatrixPage() {
	const { data, isLoading, error } = trpc.matrix.get.useQuery();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground">Loading access matrix...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-destructive">Error: {error.message}</div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground">No data available</div>
			</div>
		);
	}

	// Group by table for display
	const tables = Array.from(
		new Set(data.map((cell) => `${cell.tableSchema}.${cell.tableName}`)),
	);

	return (
		<div className="h-full overflow-auto p-6">
			<div className="mb-4">
				<h1 className="font-semibold text-xl">Access Matrix</h1>
				<p className="text-muted-foreground text-sm">
					RLS permissions overview by table and role
				</p>
			</div>

			<div className="space-y-6">
				{tables.map((tableKey) => {
					const [schema, table] = tableKey.split(".");
					const tableData = data.filter(
						(cell) => cell.tableSchema === schema && cell.tableName === table,
					);

					return (
						<div key={tableKey} className="rounded-lg border">
							<div className="border-b bg-muted/50 px-4 py-3">
								<code className="font-mono text-sm">
									{schema}.{table}
								</code>
							</div>
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/30">
										<th className="px-4 py-2 text-left font-medium">Role</th>
										<th className="px-4 py-2 text-center font-medium">
											SELECT
										</th>
										<th className="px-4 py-2 text-center font-medium">
											INSERT
										</th>
										<th className="px-4 py-2 text-center font-medium">
											UPDATE
										</th>
										<th className="px-4 py-2 text-center font-medium">
											DELETE
										</th>
									</tr>
								</thead>
								<tbody>
									{tableData.map((cell) => (
										<tr key={cell.role} className="border-b last:border-0">
											<td className="px-4 py-2 font-mono text-xs">
												{cell.role}
											</td>
											<td className="px-4 py-2 text-center">
												<PermissionIcon allowed={cell.select} />
											</td>
											<td className="px-4 py-2 text-center">
												<PermissionIcon allowed={cell.insert} />
											</td>
											<td className="px-4 py-2 text-center">
												<PermissionIcon allowed={cell.update} />
											</td>
											<td className="px-4 py-2 text-center">
												<PermissionIcon allowed={cell.delete} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PermissionIcon({ allowed }: { allowed: boolean }) {
	return allowed ? (
		<span className="text-green-500">✓</span>
	) : (
		<span className="text-red-400">✗</span>
	);
}
