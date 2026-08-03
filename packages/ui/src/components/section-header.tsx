import { cn } from "@portal-app/ui/lib/utils";

type SectionHeaderProps = {
	title: string;
	/** Optional "see all" affordance rendered on the trailing edge. */
	action?: React.ReactNode;
	/** `bar` = red tick to the left. `rule` = navy rule underneath. */
	variant?: "bar" | "rule";
	/** `dark` is for headers sitting on a navy panel. */
	tone?: "light" | "dark";
	/** Heading level, so pages keep a valid h1 → h2 → h3 outline. */
	as?: "h2" | "h3";
	className?: string;
};

function SectionHeader({
	title,
	action,
	variant = "bar",
	tone = "light",
	as: Heading = "h2",
	className,
}: SectionHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-baseline justify-between gap-4",
				variant === "rule" && "border-brand-navy border-b-2 pb-2",
				className,
			)}
		>
			<Heading
				className={cn(
					"flex items-center gap-2.5 font-extrabold text-[15px] uppercase tracking-[0.14em]",
					tone === "dark" ? "text-white" : "text-brand-navy",
				)}
			>
				{variant === "bar" ? (
					<span aria-hidden className="h-[17px] w-1 bg-brand-red" />
				) : null}
				{title}
			</Heading>
			{action}
		</div>
	);
}

export { SectionHeader };
