import { Container } from "@portal-app/ui/components/container";
import { cn } from "@portal-app/ui/lib/utils";

/** Column gaps come straight from the design: 34px default, 40/46px wider. */
const GAPS = {
	default: "lg:gap-section",
	section: "lg:gap-10",
	article: "lg:gap-major",
} as const;

/**
 * The portal's main reading grid: content column plus a 260–300px rail.
 * The rail drops below the content under `lg`, so nothing is squeezed.
 *
 * No top padding on mobile: every page that uses this opens with a full-bleed
 * band (the dark hero, the dark section header) that carries its own padding
 * and is meant to sit flush against the nav. Pages that open with ordinary
 * text add their own top spacing through `contentClassName`.
 */
export function ContentWithSidebar({
	children,
	sidebar,
	gap = "default",
	contentClassName,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
	gap?: keyof typeof GAPS;
	contentClassName?: string;
}) {
	return (
		<Container
			className={cn(
				"grid gap-stack pb-stack md:pt-stack lg:grid-cols-[minmax(0,1fr)_minmax(260px,var(--container-sidebar))]",
				GAPS[gap],
			)}
		>
			<div className={cn("min-w-0", contentClassName)}>{children}</div>
			<aside className="flex flex-col gap-stack">{sidebar}</aside>
		</Container>
	);
}
