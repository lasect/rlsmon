import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex h-5 w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-medium font-mono text-[10px] transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-accent text-[#0a0a0a]",
				secondary: "border-border bg-surface-raised text-text-muted",
				success: "border-accent/20 bg-accent/10 text-accent",
				warning: "border-warning/20 bg-warning/10 text-warning",
				error: "border-error/20 bg-error/10 text-error",
				destructive: "border-critical/10 bg-critical/10 text-critical",
				outline: "border-border text-text-muted",
				ghost: "border-transparent text-text-muted hover:bg-surface-raised",
				link: "border-transparent text-accent underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
