import { Kicker } from "@portal-app/ui/components/kicker";
import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";
import { cn } from "@portal-app/ui/lib/utils";
import Link from "next/link";

import { displayTimestamp } from "@/data/queries";
import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

import { Timestamp } from "./timestamp";

/** Photo heights are fixed per the design, not derived from an aspect ratio. */
const SIZES = {
	sm: { image: "h-[120px]", title: "text-[15.5px]" },
	md: { image: "h-[138px]", title: "text-[16.5px]" },
	lg: { image: "h-[165px]", title: "text-[21px] tracking-[-0.02em]" },
} as const;

type NewsCardProps = {
	article: Article;
	/** `sm` for related stories, `md` for grids, `lg` to lead a section block. */
	size?: keyof typeof SIZES;
	showTimestamp?: boolean;
	className?: string;
};

/** Vertical card: image on top, used in every grid on the site. */
export function NewsCard({
	article,
	size = "md",
	showTimestamp = true,
	className,
}: NewsCardProps) {
	return (
		<article className={className}>
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="group flex flex-col gap-2 text-brand-navy hover:text-brand-navy"
			>
				<MediaPlaceholder className={cn("w-full", SIZES[size].image)} />

				<Kicker variant="text">{article.kicker}</Kicker>

				<h3
					className={cn(
						"text-pretty font-bold leading-tight group-hover:text-brand-red",
						SIZES[size].title,
					)}
				>
					{article.title}
				</h3>

				{showTimestamp ? <Timestamp iso={displayTimestamp(article)} /> : null}
			</Link>
		</article>
	);
}
