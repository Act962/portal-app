import { cn } from "@portal-app/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Section/editorial label that sits above a headline.
 * Always uppercase with wide tracking — that is what makes it read as a
 * label rather than as part of the headline.
 */
/**
 * `[line-height:normal]` rather than a `leading-*` utility: tailwind-merge
 * treats font-size as conflicting with line-height, so a `leading-*` here
 * would be silently dropped by `cn()` when the variant sets `text-[10px]`.
 * The arbitrary property survives, and `normal` is what the design uses.
 */
const kickerVariants = cva("inline-block uppercase [line-height:normal]", {
	variants: {
		variant: {
			"solid-red":
				"rounded-tag bg-brand-red px-2 py-[3px] font-bold text-[10px] text-white tracking-[0.12em]",
			"solid-navy":
				"rounded-tag bg-brand-navy px-2 py-[3px] font-bold text-[10px] text-white tracking-[0.12em]",
			text: "font-mono text-[9.5px] text-brand-red tracking-[0.12em]",
		},
	},
	defaultVariants: {
		variant: "solid-red",
	},
});

type KickerProps = React.ComponentProps<"span"> &
	VariantProps<typeof kickerVariants>;

function Kicker({ className, variant, ...props }: KickerProps) {
	return (
		<span className={cn(kickerVariants({ variant, className }))} {...props} />
	);
}

export { Kicker, kickerVariants };
