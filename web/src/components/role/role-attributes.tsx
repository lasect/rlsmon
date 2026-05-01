import { cn } from "@/lib/utils";
import type { RoleInfo } from "@/types/roles";

interface RoleAttributesProps {
	role: RoleInfo;
}

export function RoleAttributes({ role }: RoleAttributesProps) {
	const attrs = [
		{ label: "Superuser", value: role.isSuperuser },
		{ label: "Can Login", value: role.canLogin },
		{ label: "Create Role", value: role.canCreateRole },
		{ label: "Create DB", value: role.canCreateDb },
		{ label: "Bypass RLS", value: role.canBypassRls },
		{ label: "Replication", value: role.canReplicate },
		{ label: "Inherit Privileges", value: role.inheritPrivileges },
		{
			label: "Connection Limit",
			value:
				role.connectionLimit === -1
					? "unlimited"
					: String(role.connectionLimit),
		},
	];

	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
			{attrs.map((attr) => (
				<Attr key={attr.label} label={attr.label} value={attr.value} />
			))}
		</div>
	);
}

function Attr({ label, value }: { label: string; value: boolean | string }) {
	const isBool = typeof value === "boolean";
	return (
		<div className="flex items-center justify-between rounded bg-card px-2 py-1">
			<span className="text-[11px] text-muted-foreground">{label}</span>
			<span
				className={cn(
					"font-mono text-[11px]",
					isBool && value ? "text-rls-grant" : "text-muted-foreground",
				)}
			>
				{isBool ? (value ? "yes" : "no") : value}
			</span>
		</div>
	);
}
