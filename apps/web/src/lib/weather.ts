/**
 * Leitura da resposta da Open-Meteo para o que o cabeçalho mostra.
 *
 * Módulo PURO — sem `fetch`, sem relógio, sem JSX (regra dos testes,
 * CLAUDE.md). Quem busca é `data/weather.ts`.
 */

export type Weather = {
	/** Já arredondada: o cabeçalho não tem espaço para decimal. */
	temperature: number;
	code: number;
	/** Descrição em português; `null` quando o código não é conhecido. */
	condition: string | null;
};

/**
 * Códigos WMO em português.
 *
 * Os de NEVE não vão acontecer no Piauí e ficam mesmo assim: a tabela é da
 * OMM, não nossa, e completá-la custa uma linha enquanto adivinhar qual código
 * "não pode chegar" é como se descobre que chegou.
 */
const CONDITIONS: Record<number, string> = {
	0: "Céu limpo",
	1: "Predominantemente claro",
	2: "Parcialmente nublado",
	3: "Nublado",
	45: "Nevoeiro",
	48: "Nevoeiro com geada",
	51: "Garoa fraca",
	53: "Garoa",
	55: "Garoa forte",
	56: "Garoa congelante",
	57: "Garoa congelante forte",
	61: "Chuva fraca",
	63: "Chuva",
	65: "Chuva forte",
	66: "Chuva congelante",
	67: "Chuva congelante forte",
	71: "Neve fraca",
	73: "Neve",
	75: "Neve forte",
	77: "Grãos de neve",
	80: "Pancadas de chuva",
	81: "Pancadas de chuva moderadas",
	82: "Pancadas de chuva fortes",
	85: "Pancadas de neve",
	86: "Pancadas de neve fortes",
	95: "Tempestade",
	96: "Tempestade com granizo",
	99: "Tempestade com granizo forte",
};

/** `null` para código desconhecido — a OMM pode acrescentar, e a temperatura
 *  continua valendo sem a descrição. */
export function conditionOf(code: unknown): string | null {
	return typeof code === "number" ? (CONDITIONS[code] ?? null) : null;
}

/**
 * Extrai o tempo atual do payload.
 *
 * **Zero é uma temperatura VÁLIDA** — e aqui está a diferença que importa em
 * relação ao módulo de cotações, onde `0` significava payload quebrado. Um
 * `if (!temperatura)` descartaria 0 °C como se fosse ausência. Não acontece em
 * Piracuruca, mas a regra não é sobre Piracuruca: é sobre não confundir
 * "ausente" com "vale zero", que é o mesmo engano em qualquer lugar.
 */
export function parseWeather(payload: unknown): Weather | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const current = (payload as { current?: unknown }).current;
	if (typeof current !== "object" || current === null) {
		return null;
	}

	const raw = current as { temperature_2m?: unknown; weather_code?: unknown };
	if (typeof raw.temperature_2m !== "number") {
		return null;
	}
	// `NaN` e `Infinity` são `typeof number` e passariam pela checagem acima.
	if (!Number.isFinite(raw.temperature_2m)) {
		return null;
	}

	const code = typeof raw.weather_code === "number" ? raw.weather_code : -1;

	return {
		temperature: round(raw.temperature_2m),
		code,
		condition: conditionOf(code),
	};
}

/**
 * Arredonda para inteiro NORMALIZANDO o zero negativo.
 *
 * `Math.round(-0.4)` devolve `-0`, não `0` — é assim que o JavaScript funciona,
 * e o teste deste módulo é que pegou. Hoje o `String(-0)` esconde o problema
 * ("0°C" na tela), então isto não é o defeito visível: é o defeito ESPERANDO,
 * para o dia em que alguém comparar, somar ou serializar essa temperatura.
 * Nunca vai acontecer em Piracuruca; a correção custa uma linha.
 */
function round(value: number): number {
	const rounded = Math.round(value);
	return rounded === 0 ? 0 : rounded;
}

/** Coordenadas de uma cidade, como a Open-Meteo devolve na busca. */
export type Coordinates = { latitude: number; longitude: number };

/**
 * Primeiro resultado da geocodificação.
 *
 * Só o PRIMEIRO, e de propósito: a busca já vai filtrada por país, e escolher
 * entre homônimos por conta própria seria adivinhar. Sem resultado, devolve
 * `null` e o cabeçalho fica sem temperatura — melhor do que mostrar o tempo de
 * outra cidade com o nome da nossa ao lado.
 */
export function parseCoordinates(payload: unknown): Coordinates | null {
	if (typeof payload !== "object" || payload === null) {
		return null;
	}

	const results = (payload as { results?: unknown }).results;
	if (!Array.isArray(results) || results.length === 0) {
		return null;
	}

	const first = results[0] as { latitude?: unknown; longitude?: unknown };
	if (
		typeof first.latitude !== "number" ||
		typeof first.longitude !== "number" ||
		!Number.isFinite(first.latitude) ||
		!Number.isFinite(first.longitude)
	) {
		return null;
	}

	return { latitude: first.latitude, longitude: first.longitude };
}

/** "36°C". Sem espaço antes do grau, como manda a norma para a unidade. */
export function formatTemperature(temperature: number): string {
	return `${temperature}°C`;
}
