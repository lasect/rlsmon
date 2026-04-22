import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm border font-medium font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-accent text-[#0a0a0a] hover:bg-accent-dim",
				outline:
					"border-border bg-transparent text-text-muted hover:border-text-muted hover:bg-surface-raised hover:text-text",
				secondary:
					"border-border bg-surface-raised text-text-muted hover:bg-surface-overlay",
				ghost:
					"border-transparent text-text-muted hover:bg-surface-raised hover:text-text",
				destructive:
					"border-critical bg-transparent text-critical hover:bg-critical/10",
				link: "border-transparent text-accent underline-offset-4 hover:underline",
			},
			size: {
				default: "h-7 px-4 py-1.5",
				xs: "h-6 px-2 text-[10px]",
				sm: "h-6 px-2.5 text-[10px]",
				lg: "h-8 px-5 py-2",
				icon: "size-8",
				"icon-xs": "size-6",
				"icon-sm": "size-7",
				"icon-lg": "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
