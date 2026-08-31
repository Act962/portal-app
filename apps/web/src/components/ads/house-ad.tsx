"use client";

import { useEffect, useRef, useState } from "react";
import type { ServableAd } from "@/data/ads";
import { pickByWeight } from "@/lib/ad-rotation";

/**
 * Um anúncio da CASA: sorteia a campanha, mostra a arte e mede.
 *
 * É cliente por dois motivos que não dá para contornar no servidor:
 *
 * 1. O SORTEIO. O portal é servido de cache (`revalidate = 60`); sortear no
 *    servidor congelaria o resultado no HTML e todo mundo veria a mesma
 *    campanha por um minuto — o rodízio deixaria de ser rodízio.
 * 2. A IMPRESSÃO só conta quando o anúncio ENTRA NA TELA. Contar no render
 *    inflaria o número com anúncios que ninguém chegou a ver: o `sidebar-tall`
 *    fica bem abaixo da dobra, e cobrar por ele como se fosse visto é vender
 *    o que não foi entregue.
 */
export function HouseAd({
	campaigns,
	className,
}: {
	campaigns: ServableAd[];
	className?: string;
}) {
	// `null` até o efeito rodar: sortear durante o render faria o HTML do
	// servidor e o do cliente discordarem, e a hidratação do React reclama —
	// com razão, porque o que ela viu não é o que ela recebeu.
	const [chosen, setChosen] = useState<ServableAd | null>(null);
	const ref = useRef<HTMLDivElement | null>(null);
	const counted = useRef(false);

	useEffect(() => {
		setChosen(pickByWeight(campaigns, Math.random()));
	}, [campaigns]);

	useEffect(() => {
		const node = ref.current;
		if (!chosen || !node || counted.current) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					// 50% visível é a régua da IAB para impressão de display. Um pixel
					// aparecendo na borda não é "visto".
					if (entry.isIntersecting && !counted.current) {
						counted.current = true;
						sendAdEvent(chosen.id, "impression");
						observer.disconnect();
					}
				}
			},
			{ threshold: 0.5 },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [chosen]);

	if (!chosen) {
		// O espaço já está reservado pelo `AdSlot` em volta, então não há salto de
		// layout enquanto o sorteio não acontece.
		return null;
	}

	return (
		<div ref={ref} className={className}>
			<a
				href={chosen.destinationUrl}
				target="_blank"
				// `sponsored` diz ao Google que este link é pago — sem ele, o portal
				// passa autoridade de busca para o anunciante, o que as diretrizes
				// tratam como esquema de links. `noopener` é segurança básica de
				// `target="_blank"`.
				rel="sponsored noopener noreferrer"
				onClick={() => sendAdEvent(chosen.id, "click")}
				className="block"
			>
				{/* `<img>` e não `next/image`: a arte vem do bucket do anunciante e o
				    `remotePatterns` do host ainda não está configurado (dívida
				    registrada). `width`/`height` quando a mídia foi medida, para o
				    navegador reservar a caixa. */}
				<img
					src={chosen.imageUrl}
					alt={chosen.altText}
					{...(chosen.width && chosen.height
						? { width: chosen.width, height: chosen.height }
						: {})}
					className="mx-auto h-auto max-w-full"
					loading="lazy"
				/>
			</a>
		</div>
	);
}

/**
 * Manda o evento sem segurar a navegação.
 *
 * `sendBeacon` de propósito: ele entrega mesmo se a página estiver sendo
 * descarregada, que é exatamente o caso do CLIQUE — o navegador já está indo
 * embora. Um `fetch` normal seria cancelado no meio e o clique se perderia.
 *
 * A alternativa seria um link que passa por `/api/ads/click?id=…` e redireciona.
 * Contaria 100%, inclusive sem JS, mas quebra copiar-endereço e abrir-em-nova-aba
 * (o leitor colaria a nossa URL de rastreamento, não a do anunciante) e põe um
 * salto entre o clique e o destino. O `href` real vale mais; a contrapartida é
 * subcontar quem navega sem JavaScript.
 */
function sendAdEvent(campaignId: string, type: "impression" | "click") {
	const body = JSON.stringify({ campaignId, type });
	try {
		if (navigator.sendBeacon) {
			navigator.sendBeacon(
				"/api/ads/event",
				new Blob([body], { type: "application/json" }),
			);
			return;
		}
		void fetch("/api/ads/event", {
			method: "POST",
			body,
			headers: { "Content-Type": "application/json" },
			keepalive: true,
		});
	} catch {
		// Medição não pode derrubar a página. Um clique não contado é um número
		// menor no relatório; uma exceção aqui seria um anúncio que não abre.
	}
}
