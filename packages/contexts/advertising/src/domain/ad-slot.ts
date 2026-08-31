/**
 * As POSIÇÕES de veiculação do portal.
 *
 * Esta lista é a canônica, e ela tem uma GÊMEA: as chaves de `AD_FORMATS` em
 * `packages/ui/src/components/ad-slot.tsx`, que é quem sabe a altura e a
 * legenda de cada caixa. As duas não podem se importar — o contexto não conhece
 * React e o `packages/ui` não pode consultar banco (regra `shared-kernel` e
 * `contextos-isolados`) —, então elas são mantidas em sincronia por um TESTE em
 * `apps/web/tests/unit/ad-slots.test.ts`, que é o único lugar que enxerga as
 * duas.
 *
 * Sem esse teste, acrescentar um formato só na UI produziria uma caixa que
 * nunca serve anúncio, e acrescentar só aqui produziria uma campanha que nunca
 * aparece. Nos dois casos sem erro nenhum: só um espaço vazio.
 */
export const AD_SLOTS = [
	"billboard",
	"in-content",
	"sidebar",
	"sidebar-tall",
	"mobile-top",
	"anchor-mobile",
] as const;

export type AdSlot = (typeof AD_SLOTS)[number];

export function isAdSlot(value: string): value is AdSlot {
	return (AD_SLOTS as readonly string[]).includes(value);
}

/** Rótulos para o painel. Ficam no domínio porque a POSIÇÃO é vocabulário do
 * negócio — é assim que a equipe comercial fala do inventário. */
export const AD_SLOT_LABELS: Record<AdSlot, string> = {
	billboard: "Topo (970×90)",
	"in-content": "Meio do conteúdo (728×90)",
	sidebar: "Lateral (300×250)",
	"sidebar-tall": "Lateral alta (300×600)",
	"mobile-top": "Topo no celular (320×70)",
	"anchor-mobile": "Âncora no rodapé do celular (320×50)",
};
