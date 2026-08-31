"use client";

import { useEffect, useRef } from "react";

/**
 * Uma unidade do Google AdSense.
 *
 * O AdSense funciona empurrando um objeto numa fila global (`adsbygoogle`) que
 * o script do Google consome. Isso precisa acontecer DEPOIS que a tag existe no
 * DOM — daí o efeito.
 *
 * A guarda do `pushed` não é zelo excessivo: em desenvolvimento o React monta,
 * desmonta e remonta cada componente (Strict Mode), e um segundo `push` na
 * mesma tag faz o Google lançar "adsbygoogle.push() error: All 'ins' elements
 * in the DOM with class=adsbygoogle already have ads in them" — que aparece
 * como erro no console e como requisição inválida no relatório.
 */
export function AdSenseUnit({
	publisherId,
	slotId,
	nonPersonalized,
	className,
}: {
	publisherId: string;
	slotId: string;
	/** Pede ao Google anúncios não personalizados — ver a nota sobre LGPD em
	 * `docs/pendencias.md`. */
	nonPersonalized: boolean;
	className?: string;
}) {
	const pushed = useRef(false);

	useEffect(() => {
		if (pushed.current) {
			return;
		}
		pushed.current = true;
		try {
			const w = window as unknown as {
				adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
			};
			w.adsbygoogle = w.adsbygoogle ?? [];
			if (nonPersonalized) {
				w.adsbygoogle.requestNonPersonalizedAds = 1;
			}
			w.adsbygoogle.push({});
		} catch {
			// Bloqueador de anúncios, script fora do ar, rede caída: o espaço fica
			// vazio. Nada disso pode derrubar a página que o leitor veio ler.
		}
	}, [nonPersonalized]);

	return (
		<ins
			className={`adsbygoogle block ${className ?? ""}`}
			style={{ display: "block" }}
			data-ad-client={publisherId}
			data-ad-slot={slotId}
			// `auto` + `full-width-responsive` deixa o Google escolher o formato que
			// cabe na caixa. A ALTURA já está reservada pelo `AdSlot` em volta, então
			// o anúncio que chegar não empurra o conteúdo (CLS zero, ui-ux.md §110).
			data-ad-format="auto"
			data-full-width-responsive="true"
		/>
	);
}
