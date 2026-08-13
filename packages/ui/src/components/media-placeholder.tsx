import { cn } from "@portal-app/ui/lib/utils";

type MediaPlaceholderProps = {
	/** Shown centred in mono type, e.g. "[ foto da manchete 16:9 ]". */
	label?: string;
	/** `dark` sits on the brand's dark panels, `light` on the page canvas. */
	tone?: "light" | "dark";
	/** Height/aspect comes from the caller so each slot reserves its own box. */
	className?: string;
};

/**
 * Stands in for an image until the media context exists.
 *
 * It always occupies the final layout box, so swapping it for `next/image`
 * later cannot introduce layout shift.
 */
function MediaPlaceholder({
	label,
	tone = "light",
	className,
}: MediaPlaceholderProps) {
	return (
		<div
			aria-hidden
			className={cn(
				"flex items-center justify-center rounded-card",
				tone === "dark" ? "hatch-dark" : "hatch-light",
				className,
			)}
		>
			{label ? (
				<span
					className={cn(
						"px-4 text-center font-mono text-[11px] tracking-[0.12em]",
						tone === "dark" ? "text-white/50" : "text-[#a29c92]",
					)}
				>
					{label}
				</span>
			) : null}
		</div>
	);
}

export { MediaPlaceholder };
