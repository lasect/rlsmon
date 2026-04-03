import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterBarProps {
	search: string;
	onSearchChange: (value: string) => void;
	toggles?: FilterToggle[];
	className?: string;
	placeholder?: string;
}

interface FilterToggle {
	label: string;
	active: boolean;
	onToggle: () => void;
}

export function FilterBar({
	search,
	onSearchChange,
	toggles = [],
	className,
	placeholder = "Search...",
}: FilterBarProps) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<div className="relative max-w-xs flex-1">
				<Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={placeholder}
					className="h-7 pl-8 text-xs"
				/>
			</div>
			{toggles.map((toggle) => (
				<button
					key={toggle.label}
					type="button"
					onClick={toggle.onToggle}
					className={cn(
						"rounded-md border px-2.5 py-1 font-medium text-[11px] transition-colors",
						toggle.active
							? "border-primary bg-primary/10 text-primary"
							: "border-border text-muted-foreground hover:bg-muted",
					)}
				>
					{toggle.label}
				</button>
			))}
		</div>
	);
}
