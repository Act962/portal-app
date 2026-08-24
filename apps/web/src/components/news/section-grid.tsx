import { cn } from "@portal-app/ui/lib/utils";
import Link from "next/link";

import { getArticlesBySection } from "@/data/queries";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

/**
 * Diretório de editorias em duas colunas, na home do celular.
 *
 * Já teve um `tone="dark"` e um `showCounts={false}`: eram da tela `/menu`,
 * que virou painel lateral e deixou de usar este componente. Saíram junto —
 * variante que ninguém chama é código que o próximo leitor tenta entender, e
 * o `showCounts` ainda escondia uma consulta que era feita e jogada fora.
 */
export async function SectionGrid({
	sections,
	className,
}: {
	sections: Section[];
	className?: string;
}) {
	// Read model é cacheado por request; conta todas as seções numa passada.
	const counts = await Promise.all(
		sections.map((section) =>
			getArticlesBySection(section.slug).then((a) => a.length),
		),
	);

	return (
		<ul className={cn("grid grid-cols-2 gap-2", className)}>
			{sections.map((section, index) => {
				const total = counts[index];

				return (
					<li key={section.slug}>
						<Link
							href={routes.section(section.slug)}
							className="flex min-h-11 flex-col justify-center gap-1 rounded-card border border-hairline bg-surface px-3 py-3 text-brand-ink hover:border-brand-deep hover:text-brand-ink"
						>
							<span className="font-bold text-sm">{section.name}</span>
							<span className="font-mono text-[9.5px] text-meta">
								{total} {total === 1 ? "matéria" : "matérias"}
							</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
