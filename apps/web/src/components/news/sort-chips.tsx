import { Chip } from "@portal-app/ui/components/chip";
import type { Route } from "next";
import Link from "next/link";

import { ARTICLE_ORDERS, type ArticleOrder } from "@/lib/sorting";

/** Ordering control for listings. Plain links, so it works without JavaScript. */
export function SortChips({
	basePath,
	current,
}: {
	basePath: string;
	current: ArticleOrder;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{Object.entries(ARTICLE_ORDERS).map(([value, label]) =>
				value === current ? (
					<Chip key={value} variant="selected" aria-current="true">
						{label}
					</Chip>
				) : (
					<Link key={value} href={`${basePath}?ordem=${value}` as Route}>
						<Chip>{label}</Chip>
					</Link>
				),
			)}
		</div>
	);
}
