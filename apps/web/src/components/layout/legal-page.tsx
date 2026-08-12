import { Container } from "@portal-app/ui/components/container";

import { PageHeading } from "@/components/news/page-heading";

/**
 * A casca das páginas de documento — Privacidade e Termos.
 *
 * Sem barra lateral, sem "mais lidas" e sem anúncio: quem abre um documento
 * destes está procurando uma informação específica, e cercar o texto de
 * chamadas para outras matérias atrapalha exatamente essa leitura.
 *
 * `max-w-[70ch]` pela mesma razão do corpo da matéria: linha longa demais faz
 * o olho perder a próxima ao voltar.
 */
export function LegalPage({
	eyebrow,
	title,
	description,
	updatedAt,
	children,
}: {
	eyebrow: string;
	title: string;
	description: string;
	/** Data da última revisão, em ISO. Documento sem data não dá para auditar. */
	updatedAt: string;
	children: React.ReactNode;
}) {
	return (
		<Container className="pb-stack md:pt-stack">
			<PageHeading eyebrow={eyebrow} title={title} description={description} />

			<p className="mb-6 font-mono text-[10px] text-meta uppercase tracking-[0.12em]">
				Última atualização:{" "}
				<time dateTime={updatedAt}>
					{/*
					  `timeZone: "UTC"`, e não o fuso da redação. `updatedAt` é uma DATA
					  DE CALENDÁRIO (`YYYY-MM-DD`), que o JS parseia como meia-noite UTC
					  — formatá-la em America/Fortaleza (UTC−3) a joga para 21h do dia
					  ANTERIOR, e "12 de agosto" aparece como 11. Aqui não há instante
					  nenhum a converter: o dia é o dado.
					*/}
					{new Date(updatedAt).toLocaleDateString("pt-BR", {
						day: "2-digit",
						month: "long",
						year: "numeric",
						timeZone: "UTC",
					})}
				</time>
			</p>

			{/*
			  Os estilos ficam aqui, num seletor de filhos, e não repetidos em cada
			  `<p>` das duas páginas: o conteúdo é texto corrido longo, e classe em
			  cada parágrafo torna a revisão do TEXTO — que é o que o cliente vai
			  fazer — uma leitura de marcação.
			*/}
			<div className="max-w-[70ch] font-serif text-[15px] text-ink leading-relaxed md:text-base [&_a]:text-brand-red [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:mb-2.5 [&_h2]:font-extrabold [&_h2]:font-sans [&_h2]:text-[19px] [&_h2]:text-brand-navy [&_h2]:tracking-[-0.02em] [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:font-bold [&_h3]:font-sans [&_h3]:text-[15px] [&_h3]:text-brand-navy [&_li]:mb-1.5 [&_p]:mb-3.5 [&_ul]:mb-3.5 [&_ul]:list-disc [&_ul]:pl-5">
				{children}
			</div>
		</Container>
	);
}
