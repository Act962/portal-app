import type { Quote } from "@/data/quotes";

/**
 * Como alta, baixa e estabilidade se apresentam.
 *
 * Vive fora dos dois componentes que consomem — a faixa da home
 * (`quotes-band.tsx`) e a tira do cabeçalho (`quotes-strip.tsx`) — porque
 * duplicar o mapa criaria duas verdades sobre a MESMA semântica: bastaria
 * alguém corrigir a leitura em um dos lados para o portal passar a dizer coisas
 * diferentes sobre o mesmo número em duas telas.
 *
 * Módulo sem JSX e sem React de propósito (regra dos testes, CLAUDE.md).
 *
 * `leitura` não é enfeite: é o que sai no texto invisível ao lado da seta. A
 * seta é `aria-hidden` — "triângulo apontando para cima" não informa nada — e a
 * COR não pode ser o único sinal, já que verde contra vermelho é exatamente a
 * distinção que falta na forma mais comum de daltonismo (WCAG 1.4.1).
 */

/** Em qual fundo o número vai ser lido. Não é estilo: é contraste. */
export type QuoteSurface = "dark" | "light";

export type QuoteDirection = {
	seta: string;
	classe: string;
	leitura: string;
};

/**
 * A cor depende do fundo, e por isso são dois pares.
 *
 * O verde claro (#3fd67e) foi escolhido para o painel escuro, onde rende 8:1.
 * O mesmo verde na barra branca do cabeçalho dá 1,9:1 — a alta some da tela. As
 * versões `-ink` existem só para esse caso.
 */
const DIRECTIONS = {
	up: {
		seta: "▲",
		leitura: "em alta",
		dark: "text-market-up",
		light: "text-market-up-ink",
	},
	down: {
		seta: "▼",
		leitura: "em baixa",
		dark: "text-market-down",
		light: "text-market-down-ink",
	},
	flat: {
		seta: "●",
		leitura: "estável",
		dark: "text-on-brand-muted",
		// `meta` seria o cinza natural aqui, mas rende 3,1:1 sobre o branco — e
		// este número tem 10px.
		light: "text-ink-muted",
	},
} as const satisfies Record<
	Quote["direction"],
	{ seta: string; leitura: string } & Record<QuoteSurface, string>
>;

export function quoteDirection(
	direction: Quote["direction"],
	surface: QuoteSurface,
): QuoteDirection {
	const entry = DIRECTIONS[direction];
	return { seta: entry.seta, leitura: entry.leitura, classe: entry[surface] };
}
