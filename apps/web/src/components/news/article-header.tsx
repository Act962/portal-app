import { Kicker } from "@portal-app/ui/components/kicker";
import Link from "next/link";

import { AuthorAvatar } from "@/components/people/author-avatar";
import type { Article, Author } from "@/data/types";
import { formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

import { ShareBar } from "./share-bar";
import { Timestamp } from "./timestamp";

type ArticleHeaderProps = {
	article: Article;
	author: Author;
	/** Absolute URL, needed by the share targets. */
	url: string;
};

export function ArticleHeader({ article, author, url }: ArticleHeaderProps) {
	return (
		<header>
			{/* Dark brown on mobile, red from `md` — the phone layout has no other brown
          anchor above the fold, the desktop one already has the masthead. */}
			<Kicker
				variant="solid-deep"
				className="mb-2.5 md:mb-3.5 md:bg-brand-accent"
			>
				{article.kicker}
			</Kicker>

			{/*
			  `data-speakable`: o `NewsArticle` aponta para estes dois nós no
			  `SpeakableSpecification` (spec 07, D5) — é o trecho que um assistente
			  de voz lê em voz alta. Atributo de DADO, e não a classe do Tailwind:
			  a classe muda a cada ajuste de layout e levaria a marcação junto sem
			  ninguém notar.
			*/}
			<h1
				data-speakable="headline"
				className="mb-2.5 text-balance font-extrabold text-[27px] text-brand-ink leading-[1.1] tracking-[-0.025em] md:mb-3.5 md:text-[44px] md:leading-[1.03] md:tracking-[-0.035em]"
			>
				{article.title}
			</h1>

			<p
				data-speakable="summary"
				className="mb-3.5 font-serif text-base text-ink-muted leading-[1.45] md:mb-5 md:text-xl md:leading-normal"
			>
				{article.standfirst}
			</p>

			<div className="mb-4 flex flex-wrap items-center gap-3 border-hairline border-y py-2.5 md:mb-stack md:py-3">
				<AuthorAvatar
					photoUrl={author.photoUrl}
					name={author.name}
					className="size-[30px] shrink-0 rounded-full md:size-9"
				/>

				<div className="min-w-0 flex-1">
					<p className="font-bold text-[12.5px] text-brand-ink md:text-[13.5px]">
						<Link
							href={routes.author(author.slug)}
							className="hover:text-brand-accent-ink"
						>
							{author.name}
						</Link>
					</p>
					<p className="font-mono text-[9.5px] text-meta md:text-[10px]">
						<Timestamp iso={article.publishedAt} variant="byline" />
						{article.updatedAt ? (
							<span>
								{" "}
								· ATUALIZADO{" "}
								{formatRelativeTime(article.updatedAt).toUpperCase()}
							</span>
						) : null}
						<span className="hidden md:inline">
							{" "}
							· {article.readingMinutes} MIN DE LEITURA
						</span>
					</p>
				</div>

				<ShareBar url={url} title={article.title} />
			</div>
		</header>
	);
}
