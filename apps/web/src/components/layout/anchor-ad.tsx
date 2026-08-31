"use client";

import { Container } from "@portal-app/ui/components/container";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * Sticky 320×50 anchor unit, mobile only.
 *
 * O anúncio chega como `children`, montado por quem chama. É um componente
 * CLIENTE (precisa do estado de "fechado"), e componente cliente não renderiza
 * Server Component assíncrono — mas recebe um pronto por prop. Quem decide se
 * esta barra existe é o SERVIDOR: sem anúncio para servir, ela não é
 * renderizada, e não sobra nem a faixa nem o botão de fechar.
 *
 * Dismissible by design: an anchor that cannot be closed eats the bottom of
 * every screen and is the kind of thing that gets a site penalised for
 * intrusive interstitials.
 *
 * `sticky` e NÃO `fixed`, e essa é a diferença que conserta o defeito. Com
 * `fixed` o banner sai do fluxo, então alguém precisa abrir espaço para ele em
 * outro lugar — era um `pb-[68px]` no wrapper do layout, que é um Server
 * Component e não sabe que este aqui foi fechado. Fechar o banner deixava os
 * 68px de branco para trás. (E o número já estava errado: o banner mede 63px.)
 *
 * Sendo `sticky`, o espaço é DELE: ocupa o lugar no fim da coluna e gruda no
 * rodapé da janela enquanto se rola. Fechar remove o elemento, e o espaço vai
 * junto — sem estado compartilhado, sem componente cliente novo na moldura do
 * grupo `(site)`, e sem medida escrita à mão para alguém errar de novo quando
 * a altura do banner mudar.
 */
export function AnchorAd({ children }: { children: React.ReactNode }) {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) {
		return null;
	}

	return (
		<aside
			aria-label="Publicidade"
			className="sticky bottom-0 z-30 border-[#e0ddd6] border-t bg-surface-alt md:hidden"
		>
			<Container className="flex items-center gap-2.5 py-1.5">
				<div className="flex-1">{children}</div>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label="Fechar publicidade"
					className="flex size-11 shrink-0 items-center justify-center text-meta-soft"
				>
					<X size={16} aria-hidden />
				</button>
			</Container>
		</aside>
	);
}
