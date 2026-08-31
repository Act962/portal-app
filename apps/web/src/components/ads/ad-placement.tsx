import type { AdSlot as AdSlotName } from "@portal-app/advertising";
import { AD_FORMATS } from "@portal-app/ui/components/ad-slot";
import { cn } from "@portal-app/ui/lib/utils";

import { AdSenseUnit } from "@/components/ads/adsense-unit";
import { HouseAd } from "@/components/ads/house-ad";
import { getSlotContent } from "@/data/ads";

/**
 * Uma POSIÇÃO de anúncio do portal, servindo conteúdo real.
 *
 * Substitui o `AdSlot` placeholder do `packages/ui` nas páginas. O `AdSlot`
 * continua existindo e continua sendo quem sabe a ALTURA e a legenda de cada
 * formato — `packages/ui` não pode consultar banco, então a divisão é: ele
 * desenha a caixa, este componente decide o que entra nela.
 *
 * A caixa é desenhada SEMPRE, inclusive quando não há nada para servir. É o que
 * mantém o CLS em zero (ui-ux.md §110): reservar o espaço depois que o anúncio
 * chega empurraria o texto que o leitor já começou a ler.
 */
export async function AdPlacement({
	slot,
	sectionId = null,
	className,
}: {
	slot: AdSlotName;
	/** A editoria da página. `null` na home, na busca e no autor — e isso é
	 * informação, não omissão: campanha segmentada não aparece ali. */
	sectionId?: string | null;
	className?: string;
}) {
	const format = AD_FORMATS[slot];
	const { campaigns, adsense } = await getSlotContent(slot, sectionId);

	// SEM NADA PARA SERVIR, a posição não existe na página.
	//
	// Antes ficava aqui uma moldura tracejada escrita "banner 300×600". Ela
	// fazia sentido enquanto era andaime — mostrava ao cliente onde o anúncio
	// entraria. Agora que a posição serve conteúdo de verdade, a moldura vazia
	// é só uma caixa cinza de 600px empurrando a notícia para baixo, e a
	// notícia é o produto (ui-ux.md §1).
	//
	// E isto NÃO reabre o problema de CLS que a altura reservada resolve: a
	// reserva existe para o anúncio que VAI chegar depois (o do Google, que é
	// assíncrono). Quando o servidor já sabe que não há nada, nada vai chegar —
	// não existe deslocamento a evitar. A reserva continua nos dois casos em
	// que ela vale, logo abaixo.
	if (campaigns.length === 0 && !adsense) {
		return null;
	}

	const maxWidth = "maxWidth" in format ? format.maxWidth : undefined;

	return (
		<aside aria-label="Publicidade" className={className}>
			<p className="mb-1.5 font-mono text-[8.5px] text-meta-soft tracking-[0.16em]">
				PUBLICIDADE
			</p>
			<div
				className="flex w-full items-center justify-center overflow-hidden"
				// A altura é reservada ANTES de o criativo carregar — é o que mantém
				// o CLS em zero (ui-ux.md §110).
				style={{ height: format.height, maxWidth }}
			>
				{campaigns.length > 0 ? (
					<HouseAd campaigns={campaigns} className="w-full" />
				) : adsense ? (
					<AdSenseUnit
						publisherId={adsense.publisherId}
						slotId={adsense.slotId}
						nonPersonalized={adsense.nonPersonalized}
						className="w-full"
					/>
				) : null}
			</div>
		</aside>
	);
}
