import { cn } from "@portal-app/ui/lib/utils";

import {
	formatByline,
	formatClock,
	formatRelativeTime,
	toDateTimeAttribute,
} from "@/lib/format";

const RENDERERS = {
	relative: formatRelativeTime,
	clock: formatClock,
	byline: formatByline,
} as const;

type TimestampProps = {
	iso: string;
	/** `relative` = "há 12 min", `clock` = "10:24", `byline` = "03 AGO 2026 · 08:14". */
	variant?: keyof typeof RENDERERS;
	className?: string;
};

/**
 * Always renders a real `<time>` with a machine-readable `datetime`, so
 * crawlers and assistive tech get the exact instant while the reader gets
 * the human phrasing.
 */
export function Timestamp({
	iso,
	variant = "relative",
	className,
}: TimestampProps) {
	return (
		<time
			dateTime={toDateTimeAttribute(iso)}
			className={cn("font-mono text-[10px] text-meta", className)}
		>
			{RENDERERS[variant](iso)}
		</time>
	);
}
