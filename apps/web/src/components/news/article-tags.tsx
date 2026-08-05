import { Chip } from "@portal-app/ui/components/chip";
import Link from "next/link";

import { routes } from "@/lib/routes";

/** As tags levam à página do assunto `/tag/{slug}` (P09). */
export function ArticleTags({ tags }: { tags: string[] }) {
	if (tags.length === 0) {
		return null;
	}

	return (
		<nav aria-label="Assuntos da matéria" className="flex flex-wrap gap-2 pt-6">
			{tags.map((tag) => (
				<Link key={tag} href={routes.tag(tag)}>
					<Chip>#{tag}</Chip>
				</Link>
			))}
		</nav>
	);
}
