/**
 * O INVENTÁRIO de publicidade: quanto mede cada posição.
 *
 * A altura vive aqui, e não em quem chama, porque a caixa precisa ser
 * reservada ANTES de qualquer criativo carregar — essa reserva é o que mantém
 * o CLS em zero (ui-ux.md §110).
 *
 * Este arquivo já teve um componente `AdSlot` que desenhava uma moldura
 * tracejada escrita "banner 300×600". Era andaime: mostrava ao cliente onde o
 * anúncio entraria, antes de existir o que servir. Com o contexto de
 * publicidade no ar quem desenha a posição é o `AdPlacement` do `apps/web`
 * (que consulta banco, coisa que `packages/ui` não pode fazer), e ele não
 * renderiza nada quando não há anúncio. O componente virou código morto e
 * saiu; ficou o que sempre foi o valor do arquivo — as medidas.
 *
 * As CHAVES daqui têm uma gêmea: `AD_SLOTS`, no domínio de publicidade. As
 * duas não podem se importar, e são mantidas em sincronia pelo teste em
 * `apps/web/tests/unit/ad-slots.test.ts`.
 */
const AD_FORMATS = {
	/**
	 * A faixa logo abaixo do cabeçalho, em toda página.
	 *
	 * Substituiu o `header-desktop` (468×60), que morava DENTRO do masthead: com
	 * a marca centralizada não sobrou lugar lateral para ele. Sair de lá foi
	 * ganho de inventário, não perda — 970×90 em largura cheia vale mais que um
	 * meio-banner espremido ao lado do logo.
	 */
	billboard: {
		height: 90,
		maxWidth: 970,
		caption: "banner 970×90 — topo",
	},
	"in-content": { height: 90, caption: "banner 728×90 — meio do conteúdo" },
	sidebar: { height: 250, caption: "banner 300×250" },
	"sidebar-tall": { height: 600, caption: "banner 300×600 — lateral" },
	"mobile-top": { height: 70, caption: "banner 320×70" },
	/**
	 * A âncora que gruda no rodapé, só no celular. Vale mais que os demais
	 * formatos móveis porque acompanha a rolagem — e é justamente por isso que
	 * ela precisa ser FECHÁVEL: âncora que não fecha come o fim de toda tela e
	 * é o tipo de coisa que rende penalização por interstitial intrusivo.
	 */
	"anchor-mobile": { height: 50, caption: "âncora 320×50 — rodapé no celular" },
} as const satisfies Record<
	string,
	{ height: number; maxWidth?: number; caption: string }
>;

type AdFormat = keyof typeof AD_FORMATS;

export type { AdFormat };
export { AD_FORMATS };
