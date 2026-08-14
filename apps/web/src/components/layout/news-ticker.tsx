import { Container } from "@portal-app/ui/components/container";
import Link from "next/link";

import type { Article } from "@/data/types";
import { routes } from "@/lib/routes";

/** Breaking-news strip under the masthead. */
export function NewsTicker({ articles }: { articles: Article[] }) {
	if (articles.length === 0) {
		return null;
	}

	return (
		/*
		  Aparece em TODAS as larguras. A faixa já foi `hidden md:block`, com o
		  argumento de que repetia a lista "Últimas notícias" da home — mas isso só
		  valia na home: numa matéria, numa editoria ou na busca, o leitor de
		  celular ficava sem nenhum acesso ao que acabou de ser publicado, que é
		  justamente onde a faixa serve para alguma coisa.

		  No celular ela é a mesma trilha rolável do desktop, só mais baixa e com a
		  tipografia um degrau menor — a rolagem horizontal já existia aqui (é o que
		  o utilitário `rail` faz, escondendo a barra e esmaecendo a borda), e no
		  toque ela é mais natural do que com o mouse.
		*/
		<section
			aria-label="Últimas notícias"
			className="border-hairline border-b bg-surface"
		>
			<Container className="flex h-9 items-center gap-2.5 overflow-hidden md:h-[42px] md:gap-4">
				<span className="shrink-0 rounded-tag bg-brand-red px-1.5 py-0.5 font-mono text-[9px] text-white tracking-[0.12em] md:px-2 md:py-1 md:text-[10px] md:tracking-[0.14em]">
					ÚLTIMAS
				</span>

				<ul className="rail flex gap-4 whitespace-nowrap md:gap-6">
					{articles.map((article) => (
						<li key={article.slug}>
							<Link
								href={routes.article(article.sectionSlug, article.slug)}
								className="font-semibold text-[12.5px] text-brand-deep hover:text-brand-red md:text-[13.5px]"
							>
								{article.title}
							</Link>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
