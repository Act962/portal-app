import { cn } from "@portal-app/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * The portal's call-to-action button: chunky, uppercase, 44px minimum height.
 *
 * Distinct from `Button` (shadcn), which is the dense control used by the
 * admin panel. Export `ctaButtonVariants` so a `next/link` can wear the same
 * styling without nesting an anchor inside a button.
 */
const ctaButtonVariants = cva(
	"inline-flex min-h-11 w-full items-center justify-center rounded-control px-4 text-center font-bold text-[12.5px] uppercase tracking-[0.06em] transition-colors focus-visible:outline-2 focus-visible:outline-brand-accent-ink focus-visible:outline-offset-2",
	{
		variants: {
			variant: {
				primary: "bg-brand-accent text-on-accent hover:bg-brand-accent-hover",
				secondary: "bg-brand-deep text-white hover:bg-brand-deep-hover",
				outline:
					"border-[1.5px] border-brand-deep text-brand-ink hover:bg-brand-deep hover:text-white",
				"on-brand": "bg-white text-brand-accent-ink hover:bg-canvas",
			},
		},
		defaultVariants: {
			variant: "primary",
		},
	},
);

type CtaButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof ctaButtonVariants>;

function CtaButton({ className, variant, type, ...props }: CtaButtonProps) {
	return (
		<button
			type={type ?? "button"}
			className={cn(ctaButtonVariants({ variant, className }))}
			{...props}
		/>
	);
}

export { CtaButton, ctaButtonVariants };
