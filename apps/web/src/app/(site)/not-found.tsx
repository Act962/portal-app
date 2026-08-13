import { Container } from "@portal-app/ui/components/container";

import { MostReadList } from "@/components/news/most-read-list";
import { SearchBox } from "@/components/search/search-box";
import { getMostRead } from "@/data/queries";

/**
 * A 404 is a reader who wanted something specific. Give them the two things
 * most likely to recover the visit — search and what everyone else is reading —
 * rather than a dead end.
 */
export default async function NotFound() {
	const mostRead = await getMostRead();
	return (
		<Container className="max-w-article py-major">
			<p className="mb-2 font-mono text-[10px] text-brand-red tracking-[0.16em]">
				ERRO 404
			</p>

			<h1 className="mb-3 font-extrabold text-4xl text-brand-deep leading-none tracking-[-0.04em]">
				Página não encontrada
			</h1>

			<p className="mb-stack max-w-[60ch] font-serif text-ink-muted text-lg">
				O endereço pode ter mudado ou a matéria pode ter sido arquivada. Tente
				buscar pelo assunto:
			</p>

			<SearchBox />

			<MostReadList articles={mostRead} period="24H" />
		</Container>
	);
}
