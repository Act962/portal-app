import "server-only";
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
 * Sem chave de API de propósito: no volume acima ela não é necessária, e uma
 * credencial a menos é uma credencial a menos para vazar ou expirar. Se um dia
 * o limite apertar, o cadastro gratuito sobe para 100 mil e entra como env.
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

/** Quanto tempo a resposta fica em cache. Casa com o `revalidate` do portal. */
const REVALIDATE_SECONDS = 60;

export type { Quote };

/**
 * As cotações da home. Lista VAZIA quando não há o que mostrar — o componente
 * não renderiza a seção, em vez de mostrar uma faixa com espaços em branco.
 */
export const loadQuotes = cache(async (): Promise<Quote[]> => {
	const pairs = HOME_PAIRS.map((item) => item.pair).join(",");

	try {
		const response = await fetch(`${ENDPOINT}/${pairs}`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			next: { revalidate: REVALIDATE_SECONDS },
		});

		// `fetch` só rejeita em falha de REDE: um 500 ou um 429 chegam aqui como
		// resposta normal, e sem esta checagem o corpo de erro seguiria para o
		// `parseQuotes` como se fosse cotação.
		if (!response.ok) {
			console.warn(
				`[cotacoes] a API respondeu ${response.status}; portal segue sem a faixa.`,
			);
			return [];
		}

		return parseQuotes(await response.json());
	} catch (error) {
		// Rede fora, timeout estourado ou JSON malformado. Mesma tolerância do
		// resto do read model (N03): degrada para vazio, nunca derruba a página.
		console.warn("[cotacoes] leitura falhou; portal segue sem a faixa:", error);
		return [];
	}
});
