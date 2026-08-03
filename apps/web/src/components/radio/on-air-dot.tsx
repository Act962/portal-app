import { cn } from "@portal-app/ui/lib/utils";

/**
 * Pulsing dot that marks live output. The animation is suppressed for readers
 * who ask for reduced motion — the colour alone still carries the meaning,
 * and the adjacent "AO VIVO" label carries it in text.
 */
export function OnAirDot({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"size-[5px] shrink-0 rounded-full bg-current motion-safe:animate-on-air",
				className,
			)}
		/>
	);
}
