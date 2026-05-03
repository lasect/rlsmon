import { Shield } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/api/trpc";
import { ApiErrorCard } from "@/components/api-error-card";
import { RoleDetail } from "@/components/role/role-detail";
import { RoleSidebar } from "@/components/role/role-sidebar";

export function RolesPage() {
	const { data, isLoading, error, refetch } = trpc.roles.list.useQuery();
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("overview");

	const { data: matrixData, isLoading: matrixLoading } =
		trpc.matrix.get.useQuery(undefined, {
			enabled: activeTab === "permissions",
		});
	const { data: policiesData, isLoading: policiesLoading } =
		trpc.policies.list.useQuery(undefined, {
			enabled: activeTab === "policies",
		});

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">Loading roles...</div>
			</div>
		);
	}

	if (error) {
		return (
			<ApiErrorCard
				error={error}
				retry={() => refetch()}
				endpoint="/api/roles"
			/>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-muted-foreground text-xs">No roles found</div>
			</div>
		);
	}

	const selected = data.find((r) => r.name === selectedName) ?? null;

	return (
		<div className="flex h-full">
			<RoleSidebar
				roles={data}
				selectedName={selectedName}
				onSelect={(name) => {
					setSelectedName(name);
					setActiveTab("overview");
				}}
			/>

			<div className="flex flex-1 flex-col overflow-auto">
				{selected ? (
					<div
						key={selected.name}
						className="slide-in-from-right flex flex-1 animate-in flex-col overflow-auto duration-200"
					>
						<RoleDetail
							role={selected}
							allRoles={data}
							activeTab={activeTab}
							onTabChange={setActiveTab}
							matrix={{ data: matrixData, isLoading: matrixLoading }}
							policies={{ data: policiesData, isLoading: policiesLoading }}
							onSelect={setSelectedName}
						/>
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
