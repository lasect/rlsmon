import { cn } from "@/lib/utils";

interface RoleBadgeProps {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	active?: boolean;
	onClick?: () => void;
}

export function RoleBadge({
	name,
	isSuperuser,
	canLogin,
	active,
	onClick,
}: RoleBadgeProps) {
	const Component = onClick ? "button" : "span";

	return (
		<Component
			type={onClick ? "button" : undefined}
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
				active
					? "bg-primary/15 font-medium text-primary"
					: onClick
						? "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
						: undefined,
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
		</Component>
	);
}
