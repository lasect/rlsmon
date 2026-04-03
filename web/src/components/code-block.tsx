import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
	code: string;
	label?: string;
	className?: string;
}

export function CodeBlock({ code, label, className }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className={cn("relative rounded-md border bg-muted/30", className)}>
			{label && (
				<div className="flex items-center justify-between border-border border-b px-3 py-1.5">
					<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
						{label}
					</span>
					<button
						type="button"
						onClick={handleCopy}
						className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
					>
						{copied ? (
							<Check className="size-3 text-rls-grant" />
						) : (
							<Copy className="size-3" />
						)}
						{copied ? "copied" : "copy"}
					</button>
				</div>
			)}
			{!label && (
				<button
					type="button"
					onClick={handleCopy}
					className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
				>
					{copied ? (
						<Check className="size-3 text-rls-grant" />
					) : (
						<Copy className="size-3" />
					)}
				</button>
			)}
			<pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}
