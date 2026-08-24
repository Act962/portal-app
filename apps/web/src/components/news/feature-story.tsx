import Link from "next/link";

import { displayTimestamp } from "@/data/queries";
import type { Article } from "@/data/types";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

import { ArticleThumb } from "./article-thumb";

/**
 * Opening story of a section page. Stacked and full-bleed on mobile; photo
 * left, text right from `md` up, where it has to out-weigh the list below it.
 */
export function FeatureStory({ article }: { article: Article }) {
	return (
		<article className="mb-1 border-hairline pb-4 md:border-b md:pb-stack">
			<Link
				href={routes.article(article.sectionSlug, article.slug)}
				className="group block text-brand-ink hover:text-brand-ink md:grid md:grid-cols-[1.3fr_1fr] md:gap-stack"
			>
				{/*
				  A sangria fica no CONTÊINER e a imagem preenche com `w-full` — o
				  mesmo arranjo do `hero-story.tsx`.

				  Antes o `-mx-4` estava na própria imagem, com `w-auto`: num `<img>`
				  isso não significa "a largura disponível", e sim a que a PROPORÇÃO da
				  foto pedir na altura fixa de 190px. Uma foto em pé saía com ~170px
				  num celular de 375px — encolhida à esquerda e ainda por cima puxada
				  para dentro da margem pelo `-mx-4`. Um `<div>` no lugar dela teria
				  ocupado a linha inteira, que é por que o espaço reservado (a matéria
				  sem capa) nunca mostrou o defeito.
				*/}
				<div className="-mx-4 md:mx-0">
					<ArticleThumb
						article={article}
						label="[ foto de abertura ]"
						className="h-[190px] w-full rounded-none md:h-[280px] md:rounded-card"
					/>
				</div>

				<div className="pt-3 md:pt-0">
					<p className="mb-1.5 font-mono text-[9px] text-brand-accent-ink uppercase tracking-[0.1em] md:mb-2 md:text-[10px] md:tracking-[0.12em]">
						Em alta · {formatRelativeTime(displayTimestamp(article))}
					</p>

					<h2 className="text-pretty font-extrabold text-[21px] leading-[1.14] tracking-[-0.02em] group-hover:text-brand-accent-ink md:mb-2.5 md:text-[30px] md:leading-[1.08] md:tracking-[-0.03em]">
						{article.title}
					</h2>

					<p className="mt-2 hidden font-serif text-[15.5px] text-ink-muted leading-normal md:mt-0 md:block">
						{article.standfirst}
					</p>
				</div>
			</Link>
		</article>
	);
}
