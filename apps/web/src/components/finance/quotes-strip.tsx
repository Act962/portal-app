import { cn } from "@portal-app/ui/lib/utils";

import { quoteDirection } from "@/components/finance/quote-direction";
import type { Quote } from "@/data/quotes";
import { formatPctChange, formatValue } from "@/lib/quotes";

/**
 * As cotações na barra do topo — a versão de uma linha da faixa da home.
 *
 * Server Component puro, como a faixa: são números que não mudam depois de
 * pintados, e a moldura do `(site)` não manda JavaScript ao leitor.
 *
 * Convive com `quotes-band.tsx` de propósito (decisão do cliente): aqui é o
 * relance permanente, presente em toda página; lá é o bloco da home, com
 * horário de atualização e fonte declarada. As duas leem o MESMO
 * `loadQuotes()`, que é `cache()` do React — a home não faz duas requisições
 * por mostrar a cotação duas vezes.
 *
 * Sem cotação nenhuma o bloco não renderiza: rótulo sem número parece defeito.
 */
export function QuotesStrip({
	quotes,
	className,
}: {
	quotes: Quote[];
	className?: string;
}) {
	if (quotes.length === 0) {
		return null;
	}

	return (
		<ul className={cn("flex items-center gap-4 lg:gap-5", className)}>
			{quotes.map((quote) => {
				// `light`: esta tira vive na barra BRANCA. O verde da faixa da home
				// renderia 1,9:1 aqui — ver `quote-direction.ts`.
				const direction = quoteDirection(quote.direction, "light");

				return (
					<li key={quote.pair} className="flex items-baseline gap-1.5">
						{/* `ink-muted`, não `meta`: o cinza de metadado rende 3,1:1 sobre
						    branco, e este rótulo tem 10px — abaixo do mínimo da WCAG. */}
						<span className="text-[10px] text-ink-muted uppercase tracking-[0.1em]">
							{quote.label}
						</span>

						<span className="font-semibold text-[11px] text-ink tabular-nums">
							{formatValue(quote.value)}
						</span>

						<span
							className={cn(
								"flex items-baseline gap-0.5 text-[10px] tabular-nums",
								direction.classe,
							)}
						>
							{/*
							  Mesma regra da faixa da home: a seta é decorativa e a direção
							  vai por extenso no texto invisível. Cor sozinha não informa
							  para quem não distingue verde de vermelho (WCAG 1.4.1).
							*/}
							<span aria-hidden>{direction.seta}</span>
							<span className="sr-only">{direction.leitura},</span>
							{formatPctChange(quote.pctChange)}
							<span className="sr-only">no dia</span>
						</span>
					</li>
				);
			})}
		</ul>
	);
}
