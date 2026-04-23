import { Circle } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const routeLabels: Record<string, string> = {
	"/explore/matrix": "Explore / Matrix",
	"/explore/policies": "Explore / Policies",
	"/explore/roles": "Explore / Roles",
	"/explore/row-access": "Explore / Row Access",
	"/simulate": "Simulate / Persona",
	"/audit": "Audit / Overview",
	"/audit/ci": "Audit / CI Mode",
	"/ai": "AI / Tools",
	"/history": "History / Snapshots",
	"/history/migration": "History / Migration",
	"/settings": "Settings",
};

export function TopBar() {
	const location = useLocation();
	const isConnected = true;
	const currentPage = routeLabels[location.pathname] || location.pathname;

	return (
		<header className="flex h-8 w-full items-center justify-between border-border border-b bg-surface px-3">
			<div className="flex items-center gap-3">
				<span className="font-bold font-mono text-accent text-sm">RLSMon</span>
				<span className="font-mono text-text-dim text-xs">/</span>
				<span className="font-mono text-text-muted text-xs">{currentPage}</span>
			</div>
			<div className="flex items-center gap-3">
				<span className="font-mono text-text-dim text-xs">localhost:5432</span>
				<div className="h-3 w-px bg-border" />
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Circle
								className="size-2 shrink-0 fill-current"
								style={{
									color: isConnected
										? "var(--color-accent)"
										: "var(--color-critical)",
								}}
							/>
							<span
								className="font-mono text-[10px]"
								style={{
									color: isConnected
										? "var(--color-accent)"
										: "var(--color-critical)",
								}}
							>
								{isConnected ? "connected" : "disconnected"}
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{isConnected ? "Connected to database" : "Not connected"}
					</TooltipContent>
				</Tooltip>
			</div>
		</header>
	);
}
