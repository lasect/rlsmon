import { trpc } from "@/api/trpc";

export function RolesPage() {
	const { data, isLoading, error } = trpc.roles.list.useQuery();

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground">Loading roles...</div>
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
				<div className="text-muted-foreground">No roles found</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto p-6">
			<div className="mb-4">
				<h1 className="font-semibold text-xl">Roles</h1>
				<p className="text-muted-foreground text-sm">
					{data.length} role{data.length !== 1 ? "s" : ""} found
				</p>
			</div>

			<div className="space-y-2">
				{data.map((role) => (
					<div key={role.name} className="rounded-lg border p-4">
						<div className="mb-2 flex items-center gap-2">
							<code className="font-medium font-mono text-sm">{role.name}</code>
							{role.isSuperuser && (
								<span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
									Superuser
								</span>
							)}
							{role.canLogin && (
								<span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-600 text-xs">
									Can Login
								</span>
							)}
						</div>
						{role.memberOf.length > 0 && (
							<div className="text-muted-foreground text-sm">
								Member of: {role.memberOf.join(", ")}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
