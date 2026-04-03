import { cn } from "@/lib/utils";

const commandColors: Record<string, string> = {
	SELECT: "bg-blue-500/15 text-blue-400 dark:bg-blue-500/15 dark:text-blue-400",
	INSERT:
		"bg-green-500/15 text-green-400 dark:bg-green-500/15 dark:text-green-400",
	UPDATE:
		"bg-amber-500/15 text-amber-400 dark:bg-amber-500/15 dark:text-amber-400",
	DELETE: "bg-red-500/15 text-red-400 dark:bg-red-500/15 dark:text-red-400",
	ALL: "bg-purple-500/15 text-purple-400 dark:bg-purple-500/15 dark:text-purple-400",
};

interface CommandBadgeProps {
	command: string;
	className?: string;
}

export function CommandBadge({ command, className }: CommandBadgeProps) {
	const colorClass =
		commandColors[command.toUpperCase()] || "bg-muted text-muted-foreground";

	return (
		<span
			className={cn(
				"inline-flex items-center rounded px-1.5 py-0.5 font-medium font-mono text-[10px]",
				colorClass,
				className,
			)}
		>
			{command}
		</span>
	);
}
