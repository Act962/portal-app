import "server-only";
import { env } from "@portal-app/env/server";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { HOME_PAIRS, parseQuotes, type Quote } from "@/lib/quotes";

/**
 * Cotações de moeda, da AwesomeAPI.
 *
 * SERVIDOR, e não o navegador do leitor. Buscar no cliente seria uma requisição
 * POR VISITANTE: a API sem chave para em 100, e um pico de audiência — que num
 * portal de notícias é o dia em que tudo importa — derrubaria a faixa
 * justamente quando há mais gente olhando.
 *
 * Quem segura o volume é o `next: { revalidate }` DESTE fetch, e não o
 * `revalidate = 60` do grupo `(site)`. A distinção importa: a home é
 * renderizada sob demanda (`ƒ` no build, porque o card de enquete lê cookie),
 * então o cache de PÁGINA não a cobre — cada visita executa este código. O que
 * evita a chamada externa é o Data Cache do Next, verificado no build de
 * produção: seis visitas seguidas deixaram UMA entrada em
 * `.next/cache/fetch-cache`, não seis. Uma requisição por minuto para o site
 * inteiro, qualquer que seja a audiência.
 *
 * **O token não é opcional em produção, e a razão custou um deploy.** Isto
 * nasceu sem chave, raciocinando pelo NOSSO volume: uma chamada por minuto,
 * folgada nos 100 do acesso anônimo. O raciocínio estava errado porque o
 * limite é por ENDEREÇO IP, e os IPs de saída da Vercel são compartilhados com
 * outros clientes — a cota se esgota por uso de terceiros. O portal tomou
 * `429` em toda visita até `AWESOMEAPI_TOKEN` existir. Sem token (dev, build,
 * CI) segue funcionando, que é o que mantém N10 de pé.
 *
 * Mesma regra do Inngest, do Redis e do Mailer (CLAUDE.md): SaaS é peça
 * trocável, nunca amarra. Quem depende disto é uma FAIXA da home — se a
 * AwesomeAPI sair do ar, a seção some e o portal segue inteiro.
 */
const ENDPOINT = "https://economia.awesomeapi.com.br/json/last";

/**
 * O portal não pode ficar esperando um terceiro para renderizar.
 *
 * Sem isto, uma API lenta (não fora do ar — LENTA, que é o caso mais comum e o
 * mais traiçoeiro) seguraria a resposta da home pelo tempo que ela levasse. Em
 * 3 segundos desistimos e servimos a página sem a faixa: nenhum leitor troca a
 * notícia pela cotação do dólar.
 */
const TIMEOUT_MS = 3000;

/**
 * Cinco minutos, não um. Cotação de moeda não é notícia de última hora, e o
 * minuto de antes só existia por simetria com o `revalidate` do portal — que,
 * como se descobriu, nem governa esta chamada. Cinco vezes menos tráfego para
 * a API sem diferença perceptível na tela.
 */
const REVALIDATE_SECONDS = 300;

export type { Quote };

/**
 * As cotações da home. Lista VAZIA quando não há o que mostrar — o componente
 * não renderiza a seção, em vez de mostrar uma faixa com espaços em branco.
 *
 * `unstable_cache` por fora do `fetch`, e essa camada é o conserto de um
 * defeito que só apareceu em produção: **o Next não guarda resposta que
 * falhou**. Com o cache só no `fetch`, cada visita reenviava a chamada — os
 * logs mostraram quatro tentativas em cinco segundos, todas 429. A falha se
 * alimentava: enquanto a API nos limitava, nós a martelávamos.
 *
 * Aqui o que fica em cache é o RESULTADO, inclusive a lista vazia. Uma API
 * fora do ar passa a custar uma tentativa a cada cinco minutos, e não uma por
 * leitor — o que importa mais ainda quando a falha é LENTIDÃO: sem isto, cada
 * visita pagaria os 3 segundos do timeout.
 */
const fetchQuotes = unstable_cache(
	async (): Promise<Quote[]> => {
		const pairs = HOME_PAIRS.map((item) => item.pair).join(",");
		const token = env.AWESOMEAPI_TOKEN;
		const url =
			`${ENDPOINT}/${pairs}` +
			(token ? `?token=${encodeURIComponent(token)}` : "");

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(TIMEOUT_MS),
				next: { revalidate: REVALIDATE_SECONDS },
			});

			// `fetch` só rejeita em falha de REDE: um 500 ou um 429 chegam aqui
			// como resposta normal, e sem esta checagem o corpo de erro seguiria
			// para o `parseQuotes` como se fosse cotação. Foi esta linha que
			// nomeou o 429 no log da Vercel e deu o diagnóstico em segundos.
			if (!response.ok) {
				console.warn(
					`[cotacoes] a API respondeu ${response.status}; portal segue sem a faixa.` +
						(response.status === 429 && !token
							? " Sem AWESOMEAPI_TOKEN: o limite anônimo é POR IP, e o da Vercel é compartilhado com outros clientes."
							: ""),
				);
				return [];
			}

			return parseQuotes(await response.json());
		} catch (error) {
			// Rede fora, timeout estourado ou JSON malformado. Mesma tolerância do
			// resto do read model (N03): degrada para vazio, nunca derruba a página.
			console.warn(
				"[cotacoes] leitura falhou; portal segue sem a faixa:",
				error,
			);
			return [];
		}
	},
	["cotacoes-home"],
	{ revalidate: REVALIDATE_SECONDS },
);

/** `cache()` do React deduplica dentro de um render; o de cima, entre visitas. */
export const loadQuotes = cache((): Promise<Quote[]> => fetchQuotes());
