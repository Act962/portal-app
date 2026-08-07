"use client";

import { useEffect, useState } from "react";

const ENDPOINT = "/api/track/pageview";
/** Marca de "esta aba já viu alguma página do portal". */
const SESSION_KEY = "portal:visited";

/**
 * Registra a visualização da matéria e quanto tempo o leitor ficou nela
 * (P05/A38). Client component ISOLADO e sem UI própria — não entra provider
 * nenhum no `(site)` (regra do CLAUDE.md: o grupo público é só RSC).
 *
 * `sendBeacon` dispara em segundo plano, sem esperar resposta e sem atrasar a
 * navegação — e, ao contrário de um `fetch`, o browser garante a entrega mesmo
 * com a página já fechando, que é o caso do segundo beacon.
 */
export function ViewTracker({ slug }: { slug: string }) {
	/**
	 * O id nasce no ESTADO, não dentro do efeito, porque em desenvolvimento o
	 * React roda o efeito duas vezes de propósito (StrictMode): gerando o id lá
	 * dentro, a segunda execução criava um id novo e a mesma leitura virava
	 * duas linhas no banco — defeito pego na verificação, não em teoria. O
	 * inicializador do `useState` é chamado uma vez por instância, então as duas
	 * execuções mandam o mesmo id, e o upsert por id absorve a repetição.
	 *
	 * A instância é trocada por matéria pelo `key` no chamador (a página), que
	 * é o que garante um id novo a cada leitura nova.
	 */
	const [viewId] = useState(() => crypto.randomUUID());

	useEffect(() => {
		const openedAt = Date.now();

		navigator.sendBeacon(
			ENDPOINT,
			JSON.stringify({ viewId, slug, referrer: referrerForThisView() }),
		);

		let closed = false;
		const close = () => {
			// `pagehide` e `visibilitychange` podem disparar os dois na mesma
			// saída; sem esta trava o tempo seria enviado duas vezes.
			if (closed) {
				return;
			}
			const seconds = Math.round((Date.now() - openedAt) / 1000);
			// Piso de 3s: abaixo disso ninguém LEU nada — é clique errado, volta
			// imediata, ou (em dev) o ciclo de remontagem do StrictMode. A
			// métrica se chama "tempo médio de leitura"; incluir esses casos
			// puxaria a média para baixo e mediria outra coisa. A visualização em
			// si já foi contada no primeiro beacon — o que se descarta aqui é só
			// a MEDIDA de tempo, não a visita.
			if (seconds < 3) {
				return;
			}
			closed = true;
			navigator.sendBeacon(
				ENDPOINT,
				JSON.stringify({ viewId, readingSeconds: seconds }),
			);
		};

		// `pagehide` cobre a navegação e o fechamento da aba; o
		// `visibilitychange` para `hidden` é o único sinal confiável no
		// iOS/Safari, onde `pagehide` nem sempre chega.
		const onVisibility = () => {
			if (document.visibilityState === "hidden") {
				close();
			}
		};
		window.addEventListener("pagehide", close);
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			window.removeEventListener("pagehide", close);
			document.removeEventListener("visibilitychange", onVisibility);
			// Navegação client-side (Next) desmonta sem disparar `pagehide` —
			// fechar aqui é o que mede a leitura de quem clicou em outra matéria.
			close();
		};
	}, [slug, viewId]);

	return null;
}

/**
 * O referrer a reportar para ESTA visualização.
 *
 * `document.referrer` só é confiável no primeiro carregamento da aba: numa
 * navegação client-side do Next o documento não recarrega, então o valor fica
 * congelado no que trouxe o leitor ao site. Sem este ajuste, um clique de uma
 * matéria para outra era reportado com o referrer original — e a categoria
 * "interno" praticamente nunca aparecia. (Também confirmado na verificação.)
 *
 * A partir da segunda página da mesma aba, portanto, a origem é o próprio
 * portal. A classificação em si continua no SERVIDOR — o cliente só relata,
 * honestamente, de onde veio.
 */
function referrerForThisView(): string {
	try {
		const seen = sessionStorage.getItem(SESSION_KEY);
		sessionStorage.setItem(SESSION_KEY, "1");
		return seen ? window.location.origin : document.referrer;
	} catch {
		// sessionStorage bloqueado (modo privado, iframe): cair no referrer do
		// documento é o comportamento menos errado.
		return document.referrer;
	}
}
