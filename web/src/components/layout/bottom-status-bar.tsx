import { User } from "lucide-react";

interface BottomStatusBarProps {
	persona?: {
		name: string;
		role?: string;
	} | null;
}

export function BottomStatusBar({ persona }: BottomStatusBarProps) {
	if (!persona) {
		return null;
	}

	return (
		<footer className="flex h-8 items-center border-border border-t bg-muted/50 px-4">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<User className="size-3 shrink-0" />
				<span>Persona:</span>
				<span className="font-medium text-foreground">{persona.name}</span>
				{persona.role && (
					<>
						<span className="text-muted-foreground/50">|</span>
						<span>{persona.role}</span>
					</>
				)}
			</div>
		</footer>
	);
}
