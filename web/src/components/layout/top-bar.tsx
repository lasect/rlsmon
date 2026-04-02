import { Circle } from "lucide-react";

interface TopBarProps {
	connectionString?: string;
	isConnected?: boolean;
}

export function TopBar({
	connectionString = "Not connected",
	isConnected = false,
}: TopBarProps) {
	return (
		<header className="flex h-12 items-center justify-between border-border border-b bg-background px-4">
			<div className="flex items-center gap-2">
				<span className="font-medium text-sm">{connectionString}</span>
			</div>
			<div className="flex items-center gap-2">
				<Circle
					className="size-2 shrink-0"
					fill={isConnected ? "currentColor" : "none"}
					stroke={isConnected ? "none" : "currentColor"}
					strokeWidth={2}
					data-connected={isConnected}
					style={{
						color: isConnected ? "var(--chart-2)" : "var(--muted-foreground)",
					}}
				/>
			</div>
		</header>
	);
}
