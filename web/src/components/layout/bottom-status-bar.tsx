import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { usePersona } from "@/context/persona-context";

export function BottomStatusBar() {
	const { persona } = usePersona();
	const navigate = useNavigate();

	const showPersona = persona.role && persona.lastRunAt;

	return (
		<footer className="flex h-7 items-center justify-between border-border border-t bg-card px-3">
			<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<User className="size-3 shrink-0" />
					{showPersona ? (
						<button
							type="button"
							onClick={() => navigate("/simulate")}
							className="text-primary hover:underline"
						>
							persona: {persona.role}
						</button>
					) : (
						<span>no persona</span>
					)}
				</div>
			</div>
			<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
				<Separator orientation="vertical" className="h-3 bg-primary/30" />
				<span>pg</span>
			</div>
		</footer>
	);
}
