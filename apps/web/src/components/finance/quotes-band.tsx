import { SectionHeader } from "@portal-app/ui/components/section-header";
import { cn } from "@portal-app/ui/lib/utils";

import { Timestamp } from "@/components/news/timestamp";
import type { Quote } from "@/data/quotes";
import { formatPctChange, formatValue } from "@/lib/quotes";

/**
 * A faixa de cotações da home, no lugar onde ficava a "TV 7 Cidades".
 *
 * Server Component puro: nada aqui precisa do navegador, e o grupo `(site)`
 * não tem providers. Zero JavaScript enviado ao leitor por uma faixa que só
 * mostra números.
 *
 * Sem cotação NENHUMA a seção não aparece — mesma decisão do bloco de
 * colunistas e da grade de programação: faixa com título e espaços vazios é
 * pior do que faixa nenhuma, porque parece defeito. Com uma ou duas moedas ela
 * aparece com o que houver: a ausência de uma não invalida as outras.
 */
const DIRECTION = {
	up: { seta: "▲", classe: "text-market-up", leitura: "em alta" },
	down: { seta: "▼", classe: "text-market-down", leitura: "em baixa" },
	flat: { seta: "●", classe: "text-on-navy-muted", leitura: "estável" },
} as const;

export function QuotesBand({ quotes }: { quotes: Quote[] }) {
	if (quotes.length === 0) {
		return null;
	}

	// A cotação mais recente do conjunto responde por todas: elas vêm da mesma
	// requisição e do mesmo instante, e três horários idênticos lado a lado
	// seriam repetição sem informação.
	const updatedAt = quotes.find((quote) => quote.updatedAt !== null)?.updatedAt;

	return (
		<section className="-mx-4 mt-6 bg-brand-navy px-4 py-5 md:mx-0 md:mt-section md:rounded-panel md:px-7 md:py-stack">
			<SectionHeader
				title="Cotações"
				tone="dark"
				className="mb-4.5"
				action={
					updatedAt ? (
						<span className="font-mono text-[10px] text-on-navy-dim md:text-[11px]">
							ATUALIZADO <Timestamp iso={updatedAt} variant="relative" />
						</span>
					) : null
				}
			/>

			<ul className="grid gap-3 sm:grid-cols-3 md:gap-5">
				{quotes.map((quote) => {
					const direction = DIRECTION[quote.direction];

					return (
						<li
							key={quote.pair}
							className="rounded-card border border-on-navy-rule px-4 py-3.5"
						>
							<p className="font-mono text-[9.5px] text-on-navy-muted uppercase tracking-[0.14em]">
								{quote.label}
							</p>

							<p className="mt-1 font-extrabold text-[22px] text-white leading-none tracking-[-0.02em] md:text-[26px]">
								{formatValue(quote.value)}
							</p>

							<p
								className={cn(
									"mt-1.5 flex items-center gap-1.5 font-mono text-[11px]",
									direction.classe,
								)}
							>
								{/*
								  A seta é `aria-hidden` e a direção é dita por extenso no
								  texto invisível ao lado. Um leitor de tela anunciando
								  "triângulo apontando para cima" não informa nada; e a cor
								  sozinha não serviria de qualquer forma para quem não
								  distingue verde de vermelho.
								*/}
								<span aria-hidden>{direction.seta}</span>
								<span className="sr-only">{direction.leitura},</span>
								{formatPctChange(quote.pctChange)}
								<span className="sr-only">no dia</span>
							</p>
						</li>
					);
				})}
			</ul>

			<p className="mt-3.5 font-mono text-[9px] text-on-navy-dim md:text-[9.5px]">
				VALORES DE COMPRA, EM REAIS · FONTE: AWESOMEAPI
			</p>
		</section>
	);
}
