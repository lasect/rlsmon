import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowDrawerProps {
	open: boolean;
	onClose: () => void;
	row: Record<string, unknown> | null;
	columns: string[];
}

export function RowDrawer({ open, onClose, row, columns }: RowDrawerProps) {
	if (!open || !row) return null;

	const copyAsJson = async () => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
		} catch {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = JSON.stringify(row, null, 2);
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
		}
	};

	const formatValue = (value: unknown): string => {
		if (value === null) return "NULL";
		if (typeof value === "object") {
			return JSON.stringify(value, null, 2);
		}
		return String(value);
	};

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
				)}
			>
				<div className="flex items-center justify-between border-border border-b px-4 py-2.5">
					<h2 className="font-medium font-mono text-sm">Row Details</h2>
					<button
						type="button"
						onClick={onClose}
						className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X className="size-3.5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4">
					<button
						type="button"
						onClick={copyAsJson}
						className="mb-4 w-full rounded bg-muted px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
					>
						Copy row as JSON
					</button>
					<div className="space-y-3">
						{columns.map((col) => (
							<div key={col}>
								<div className="mb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
									{col}
								</div>
								<pre
								className={cn(
									"whitespace-pre-wrap break-all rounded bg-card p-2 font-mono text-[11px]",
									row[col] === null && "text-muted-foreground italic",
								)}
								>
									{formatValue(row[col])}
								</pre>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
