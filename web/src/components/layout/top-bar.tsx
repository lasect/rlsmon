import { Circle, Database } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function TopBar() {
	const isConnected = true;

	return (
		<header className="flex h-8 items-center justify-between border-border border-b bg-surface px-3">
			<div className="flex items-center gap-2">
				<Database className="size-3 text-text-muted" />
				<span className="font-mono text-text-muted text-xs">
					localhost:5432
				</span>
			</div>
			<div className="flex items-center gap-2">
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
