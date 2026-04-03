import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideOverProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	className?: string;
}

export function SlideOver({
	open,
	onClose,
	title,
	children,
	className,
}: SlideOverProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-40">
			<button
				type="button"
				className="absolute inset-0 bg-background/60 backdrop-blur-sm"
				onClick={onClose}
				aria-label="Close panel"
			/>
			<div
				className={cn(
					"absolute top-0 right-0 h-full w-[420px] border-border border-l bg-card shadow-xl transition-all",
					"flex flex-col",
					className,
				)}
			>
				<div className="flex items-center justify-between border-border border-b px-4 py-2.5">
					<h2 className="font-medium font-mono text-sm">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X className="size-3.5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4">{children}</div>
			</div>
		</div>
	);
}
