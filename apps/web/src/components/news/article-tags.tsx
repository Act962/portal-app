import { Chip } from "@portal-app/ui/components/chip";
import Link from "next/link";

import { routes } from "@/lib/routes";

/** Tags link into search rather than a dedicated tag page (a Phase 4 feature). */
export function ArticleTags({ tags }: { tags: string[] }) {
	if (tags.length === 0) {
		return null;
	}

	return (
		<nav aria-label="Assuntos da matéria" className="flex flex-wrap gap-2 pt-6">
			{tags.map((tag) => (
				<Link key={tag} href={routes.searchFor(tag)}>
					<Chip>#{tag}</Chip>
				</Link>
			))}
		</nav>
	);
}
