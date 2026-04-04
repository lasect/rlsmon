import { Circle, Database } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function TopBar() {
	return (
		<header className="flex h-10 items-center justify-between border-border border-t-2 border-t-primary border-b bg-background px-4">
			<div className="flex items-center gap-2">
				<Database className="size-3.5 text-muted-foreground" />
				<span className="font-mono text-muted-foreground text-xs">
					localhost:5432
				</span>
			</div>
			<div className="flex items-center gap-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Circle
								className="size-2 shrink-0"
								fill="currentColor"
								style={{ color: "var(--rls-grant)" }}
							/>
							<span className="text-muted-foreground text-xs">connected</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom">Connected to database</TooltipContent>
				</Tooltip>
			</div>
		</header>
	);
}
