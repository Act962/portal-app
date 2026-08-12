import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { loadSiteSettings } from "@/data/queries";
import {
	type Coordinates,
	parseCoordinates,
	parseWeather,
	type Weather,
} from "@/lib/weather";

/**
 * O tempo agora, da Open-Meteo, para a cidade CONFIGURADA nas Configurações.
 *
 * Substitui o `"32°C"` fixo do cabeçalho (D12) — um valor que parecia dado ao
 * vivo e mentia todo dia, inclusive quando chovia. No momento em que isto foi
 * escrito Piracuruca marcava 36 °C: quatro graus de diferença.
 *
 * Segue a cidade das Configurações em vez de coordenada escrita no código. Se
 * o veículo mudar de praça, o cabeçalho acompanha sem deploy — e ninguém
 * precisa saber latitude para configurar um portal de notícias.
 *
 * O cabeçalho está em TODA página do portal, e a home é renderizada sob
 * demanda — então quem evita a chamada externa a cada visita é o Data Cache do
 * Next (`next: { revalidate }` abaixo), não o cache de página. Verificado no
 * build de produção: seis visitas seguidas deixaram UMA entrada por endpoint em
 * `.next/cache/fetch-cache`. Na prática, quatro chamadas por hora.
 *
 * **Licença:** o plano gratuito da Open-Meteo é declarado para uso NÃO
 * COMERCIAL. O portal de uma rádio comercial provavelmente não se enquadra, e
 * isso é decisão do cliente, não técnica — registrado em `docs/pendencias.md`.
 * O volume não é o problema; a licença é.
 */
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";

/** Mesmo teto das cotações: notícia não espera previsão do tempo. */
const TIMEOUT_MS = 3000;

/** A temperatura muda devagar, e a Open-Meteo atualiza a cada 15 minutos. */
const WEATHER_REVALIDATE = 900;

/**
 * Coordenada de cidade não muda. Um mês de cache transforma esta chamada em
 * praticamente zero — o caminho quente nunca sai da rede, e o frio acontece
 * uma vez por mês.
 */
const GEOCODING_REVALIDATE = 60 * 60 * 24 * 30;

async function fetchJson(
	url: string,
	revalidate: number,
	what: string,
): Promise<unknown | null> {
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			next: { revalidate },
		});

		// `fetch` só rejeita em falha de REDE: um 500 chega aqui como resposta
		// normal e seguiria para o parse como se fosse dado.
		if (!response.ok) {
			console.warn(`[tempo] ${what} respondeu ${response.status}; ignorado.`);
			return null;
		}
		return await response.json();
	} catch (error) {
		console.warn(`[tempo] ${what} falhou; cabeçalho segue sem:`, error);
		return null;
	}
}

/**
 * Coordenadas da cidade configurada.
 *
 * Vai filtrada por país e leva o ESTADO junto no termo de busca: "Piracuruca"
 * é único no Brasil, mas nem toda cidade é — e o cabeçalho mostrando o tempo
 * de uma homônima, com o nome da nossa ao lado, seria errado sem parecer.
 */
const loadCoordinates = cache(async (): Promise<Coordinates | null> => {
	const site = await loadSiteSettings();
	const term = `${site.city} ${site.state}`.trim();
	if (!term) {
		return null;
	}

	const url = `${GEOCODING}?name=${encodeURIComponent(site.city)}&count=1&language=pt&format=json&countryCode=BR`;
	const coordinates = parseCoordinates(
		await fetchJson(url, GEOCODING_REVALIDATE, "a busca de coordenadas"),
	);

	if (!coordinates) {
		console.warn(
			`[tempo] não achei coordenadas para "${term}"; cabeçalho segue sem temperatura.`,
		);
	}
	return coordinates;
});

/**
 * `null` quando não há o que mostrar — o cabeçalho omite a temperatura.
 *
 * `unstable_cache` por fora, pela mesma razão das cotações: **o Next não
 * guarda resposta que falhou**, então sem esta camada uma API fora do ar
 * custaria uma tentativa POR VISITA. Aqui pesa mais do que lá — a faixa de
 * cotações está só na home, o cabeçalho está em TODA página —, e o caso ruim
 * não é a API cair e sim ficar LENTA: cada leitor pagaria os 3 segundos do
 * timeout, em qualquer página que abrisse.
 *
 * O que fica em cache é o resultado, inclusive o `null`.
 */
const fetchWeather = unstable_cache(
	async (): Promise<Weather | null> => {
		const coordinates = await loadCoordinates();
		if (!coordinates) {
			return null;
		}

		const url =
			`${FORECAST}?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}` +
			"&current=temperature_2m,weather_code&timezone=America%2FFortaleza";

		return parseWeather(await fetchJson(url, WEATHER_REVALIDATE, "a previsão"));
	},
	["tempo-cabecalho"],
	{ revalidate: WEATHER_REVALIDATE },
);

/** `cache()` do React deduplica dentro de um render; o de cima, entre visitas. */
export const loadWeather = cache((): Promise<Weather | null> => fetchWeather());

export type { Weather };
