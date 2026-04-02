import { trpc } from "@/api/trpc";

export function PoliciesPage() {
	const { data, isLoading, error } = trpc.policies.list.useQuery();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground">Loading policies...</div>
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
				<div className="text-muted-foreground">No policies found</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto p-6">
			<div className="mb-4">
				<h1 className="font-semibold text-xl">Policies</h1>
				<p className="text-muted-foreground text-sm">
					{data.length} RLS policy{data.length !== 1 ? "ies" : "y"} found
				</p>
			</div>

			<div className="space-y-4">
				{data.map((policy) => (
					<div key={policy.name} className="rounded-lg border p-4">
						<div className="mb-2 flex items-center justify-between">
							<code className="font-medium font-mono text-sm">
								{policy.name}
							</code>
							<span className="rounded bg-muted px-2 py-1 text-xs">
								{policy.command}
							</span>
						</div>
						<div className="mb-2 text-muted-foreground text-sm">
							<code className="font-mono">
								{policy.schema}.{policy.table}
							</code>
						</div>
						<div className="space-y-1 text-sm">
							<div>
								<span className="text-muted-foreground">To: </span>
								{policy.roles.join(", ")}
							</div>
							{policy.using && (
								<div className="mt-2 rounded bg-muted/50 p-2 font-mono text-xs">
									<div className="mb-1 text-muted-foreground">USING:</div>
									{policy.using}
								</div>
							)}
							{policy.withCheck && (
								<div className="mt-2 rounded bg-muted/50 p-2 font-mono text-xs">
									<div className="mb-1 text-muted-foreground">WITH CHECK:</div>
									{policy.withCheck}
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
