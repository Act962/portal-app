import { SectionHeader } from "@portal-app/ui/components/section-header";
import Link from "next/link";

import { AuthorAvatar } from "@/components/people/author-avatar";
import type { Columnist } from "@/data/types";
import { routes } from "@/lib/routes";

export function ColumnistGrid({ columnists }: { columnists: Columnist[] }) {
	return (
		<section className="mt-6 md:mt-section">
			<SectionHeader
				title="Colunistas"
				className="mb-4"
				action={
					<Link
						href={routes.columnists}
						className="font-mono text-[10px] text-brand-red md:text-[11px]"
					>
						VER TODOS →
					</Link>
				}
			/>

			<ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{columnists.map((columnist) => (
					<li key={columnist.slug}>
						{/*
						  Leva à PESSOA, não à editoria. O cartão apontava para
						  `/{editoria}`, o que deixava a página do colunista — que existe,
						  com perfil, matérias e SEO — inalcançável a partir da home.
						*/}
						<Link
							href={routes.author(columnist.slug)}
							// A elevação de 1px no hover: o suficiente para o cartão
							// responder ao mouse, longe o bastante de "pular". `-translate-y`
							// e não `margin`, porque transform não reflui o layout — o
							// vizinho não se mexe junto.
							className="flex items-center gap-3.5 rounded-card border border-hairline bg-surface p-4.5 text-brand-deep transition-[colors,transform,box-shadow] duration-200 hover:-translate-y-px hover:border-brand-deep hover:text-brand-deep hover:shadow-sm"
						>
							{/* `name` vazio: o nome já está escrito ao lado, dentro do mesmo
							    link. Repeti-lo no `alt` faria o leitor de tela anunciar a
							    pessoa duas vezes. */}
							<AuthorAvatar
								photoUrl={columnist.photoUrl}
								name=""
								className="size-[62px] shrink-0 rounded-[10px]"
							/>
							<span>
								<span className="block font-extrabold text-base">
									{columnist.name}
								</span>
								{columnist.beat ? (
									<span className="my-1 block font-mono text-[9.5px] text-brand-red uppercase tracking-[0.1em]">
										{columnist.beat}
									</span>
								) : null}
								{columnist.blurb ? (
									<span className="block font-serif text-[13px] text-ink-muted leading-normal">
										{columnist.blurb}
									</span>
								) : null}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
