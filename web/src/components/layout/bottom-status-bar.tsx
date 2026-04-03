import { User } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function BottomStatusBar() {
	return (
		<footer className="flex h-7 items-center justify-between border-border border-t bg-muted/30 px-3">
			<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<User className="size-3 shrink-0" />
					<span>no persona</span>
				</div>
			</div>
			<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
				<Separator orientation="vertical" className="h-3" />
				<span>pg</span>
			</div>
		</footer>
	);
}
