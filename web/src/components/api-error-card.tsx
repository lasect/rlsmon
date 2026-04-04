import { AlertCircle, Copy, RotateCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ApiErrorCardProps {
	error: { message: string; name?: string };
	retry?: () => void;
	endpoint?: string;
}

export function ApiErrorCard({ error, retry, endpoint }: ApiErrorCardProps) {
	const [copied, setCopied] = useState(false);

	const isNetworkError = error.message === "Failed to fetch";

	const details = [
		{ label: "Type", value: isNetworkError ? "Network Error" : error.name },
		{ label: "Message", value: error.message },
		...(endpoint ? [{ label: "Endpoint", value: endpoint }] : []),
	];

	const handleCopy = () => {
		const text = details.map((d) => `${d.label}: ${d.value}`).join("\n");
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="flex h-full items-center justify-center p-4">
			<div className="w-full max-w-md rounded-lg border border-destructive/20 bg-destructive/[0.03] p-4">
				<div className="mb-3 flex items-start gap-2.5">
					<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10">
						<AlertCircle className="size-3.5 text-destructive" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="font-medium text-foreground text-sm">
							{isNetworkError ? "Cannot connect to server" : "Request failed"}
						</div>
						{isNetworkError && (
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								The API server at{" "}
								<code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
									localhost:2711
								</code>{" "}
								is unreachable. Make sure{" "}
								<code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
									npx rlsmon
								</code>{" "}
								is running.
							</p>
						)}
					</div>
				</div>

				<div className="space-y-1 rounded-md border border-border/50 bg-background/50 p-2.5 font-mono text-[10px] leading-relaxed">
					{details.map((d, i) => (
						<div
							key={d.label}
							className={cn(i > 0 && "mt-1.5 border-border/50 border-t pt-1.5")}
						>
							<span className="text-muted-foreground/60">{d.label}:</span>{" "}
							<span className="break-all text-foreground/80">{d.value}</span>
						</div>
					))}
				</div>

				<div className="mt-3 flex items-center gap-2">
					{retry && (
						<button
							type="button"
							onClick={retry}
							className="flex items-center gap-1.5 rounded bg-destructive/10 px-2.5 py-1.5 font-medium text-[11px] text-destructive transition-colors hover:bg-destructive/15"
						>
							<RotateCw className="size-3" />
							Retry
						</button>
					)}
					<button
						type="button"
						onClick={handleCopy}
						className="flex items-center gap-1.5 rounded border border-border/50 bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						{copied ? (
							<>
								<Copy className="size-3" />
								Copied
							</>
						) : (
							<>
								<Copy className="size-3" />
								Copy
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
