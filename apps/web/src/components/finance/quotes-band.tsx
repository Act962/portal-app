import { SectionHeader } from "@portal-app/ui/components/section-header";
import { cn } from "@portal-app/ui/lib/utils";

import { quoteDirection } from "@/components/finance/quote-direction";
import { RupestreTexture } from "@/components/layout/rupestre-texture";
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
export function QuotesBand({ quotes }: { quotes: Quote[] }) {
	if (quotes.length === 0) {
		return null;
	}

	// A cotação mais recente do conjunto responde por todas: elas vêm da mesma
	// requisição e do mesmo instante, e três horários idênticos lado a lado
	// seriam repetição sem informação.
	const updatedAt = quotes.find((quote) => quote.updatedAt !== null)?.updatedAt;

	return (
		<section className="relative -mx-4 mt-6 overflow-hidden bg-brand-deep px-4 py-5 md:mx-0 md:mt-section md:rounded-panel md:px-7 md:py-stack">
			{/*
			  Canto inferior direito: a linha de rodapé da faixa ("VALORES DE
			  COMPRA…") é curta e mora à esquerda, então este é o vão do bloco. A
			  textura não pode encostar nela — é `on-brand-dim`, que sobre o
			  grafismo cai para 2,9:1.
			*/}
			<RupestreTexture className="right-0 bottom-0 hidden h-14 translate-y-2 md:block" />
			<SectionHeader
				title="Cotações"
				tone="dark"
				className="mb-4.5"
				action={
					updatedAt ? (
						<span className="font-mono text-[10px] text-on-brand-dim md:text-[11px]">
							ATUALIZADO{" "}
							<Timestamp
								iso={updatedAt}
								variant="relative"
								// O padrão do Timestamp é `text-meta`, que é tinta de
								// superfície clara: aqui dentro da placa daria 1,28:1.
								className="text-on-brand-dim"
							/>
						</span>
					) : null
				}
			/>

			<ul className="grid gap-3 sm:grid-cols-3 md:gap-5">
				{quotes.map((quote) => {
					const direction = quoteDirection(quote.direction, "dark");

					return (
						<li
							key={quote.pair}
							className="rounded-card border border-on-brand-rule px-4 py-3.5"
						>
							<p className="font-mono text-[9.5px] text-on-brand-muted uppercase tracking-[0.14em]">
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

			{/*
			  `w-fit` não é estética: como `<p>` de bloco, a caixa ia até a borda
			  direita e passava POR CIMA da textura, embora a tinta pare na metade.
			  Este texto é `on-brand-dim` — 2,3:1 sobre o grafismo —, então a caixa
			  precisa dizer a verdade sobre onde as letras estão.
			*/}
			<p className="mt-3.5 w-fit font-mono text-[9px] text-on-brand-dim md:text-[9.5px]">
				VALORES DE COMPRA, EM REAIS · FONTE: AWESOMEAPI
			</p>
		</section>
	);
}
