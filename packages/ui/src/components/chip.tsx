import { cn } from "@portal-app/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/** Filter, tag and pagination pill. */
const chipVariants = cva(
	"inline-flex min-h-11 items-center rounded-control px-3 font-mono text-[10.5px] transition-colors",
	{
		variants: {
			variant: {
				default:
					"border border-hairline-strong bg-surface text-ink-muted hover:border-brand-accent-ink hover:text-brand-accent-ink",
				selected: "bg-brand-deep text-white",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type ChipProps = React.ComponentProps<"span"> &
	VariantProps<typeof chipVariants>;

function Chip({ className, variant, ...props }: ChipProps) {
	return (
		<span className={cn(chipVariants({ variant, className }))} {...props} />
	);
}

export { Chip, chipVariants };
