import { describe, expect, it } from "vitest";

import {
	conditionOf,
	formatTemperature,
	parseCoordinates,
	parseWeather,
} from "@/lib/weather";

/** Resposta da Open-Meteo como ela chega de verdade (conferida contra a API). */
const PAYLOAD = {
	latitude: -3.9015818,
	longitude: -41.741272,
	timezone: "America/Fortaleza",
	current_units: { temperature_2m: "°C", weather_code: "wmo code" },
	current: {
		time: "2026-08-12T14:45",
		interval: 900,
		temperature_2m: 36.1,
		weather_code: 1,
	},
};

describe("parseWeather", () => {
	it("lê temperatura e condição do tempo atual", () => {
		const weather = parseWeather(PAYLOAD);

		expect(weather).toEqual({
			temperature: 36,
			code: 1,
			condition: "Predominantemente claro",
		});
	});

	it("arredonda — o cabeçalho não tem espaço para decimal", () => {
		expect(parseWeather(comTemperatura(36.1))?.temperature).toBe(36);
		expect(parseWeather(comTemperatura(36.6))?.temperature).toBe(37);
	});

	it("ZERO é temperatura válida, não ausência", () => {
		// A diferença que importa em relação ao módulo de cotações, onde 0
		// significava payload quebrado. Um `if (!temperatura)` descartaria 0 °C.
		// Não acontece em Piracuruca, mas a regra não é sobre Piracuruca.
		expect(parseWeather(comTemperatura(0))?.temperature).toBe(0);
	});

	it("temperatura negativa passa, e -0,4 vira 0 e não '-0'", () => {
		expect(parseWeather(comTemperatura(-5))?.temperature).toBe(-5);
		expect(Object.is(parseWeather(comTemperatura(-0.4))?.temperature, 0)).toBe(
			true,
		);
	});

	it.each([
		["NaN", Number.NaN],
		["Infinity", Number.POSITIVE_INFINITY],
	])("recusa temperatura %s", (_caso, valor) => {
		// Os dois são `typeof number` e passariam por uma checagem só de tipo.
		expect(parseWeather(comTemperatura(valor))).toBeNull();
	});

	it("mantém a temperatura quando o código do tempo é desconhecido", () => {
		// A OMM pode acrescentar códigos; a temperatura continua valendo sem a
		// descrição ao lado.
		const weather = parseWeather({
			current: { temperature_2m: 30, weather_code: 4242 },
		});

		expect(weather?.temperature).toBe(30);
		expect(weather?.condition).toBeNull();
	});

	it.each([
		["sem `current`", { latitude: -3.9 }],
		["`current` não é objeto", { current: "quente" }],
		["temperatura ausente", { current: { weather_code: 1 } }],
		["temperatura como string", { current: { temperature_2m: "36.1" } }],
		["payload nulo", null],
		["payload texto", "erro 500"],
	])("devolve null para %s, sem estourar", (_caso, payload) => {
		expect(parseWeather(payload)).toBeNull();
	});
});

describe("conditionOf", () => {
	it("traduz os códigos WMO", () => {
		expect(conditionOf(0)).toBe("Céu limpo");
		expect(conditionOf(63)).toBe("Chuva");
		expect(conditionOf(95)).toBe("Tempestade");
	});

	it("devolve null para código fora da tabela", () => {
		expect(conditionOf(4242)).toBeNull();
		expect(conditionOf("1")).toBeNull();
		expect(conditionOf(undefined)).toBeNull();
	});
});

describe("parseCoordinates", () => {
	const RESPOSTA = {
		results: [
			{
				name: "Piracuruca",
				latitude: -3.92806,
				longitude: -41.70917,
				admin1: "Piauí",
			},
			{ name: "Outra", latitude: 10, longitude: 20 },
		],
	};

	it("fica com o primeiro resultado", () => {
		// A busca já vai filtrada por país; escolher entre homônimos por conta
		// própria seria adivinhar.
		expect(parseCoordinates(RESPOSTA)).toEqual({
			latitude: -3.92806,
			longitude: -41.70917,
		});
	});

	it.each([
		["sem resultado", { results: [] }],
		["sem a chave `results`", {}],
		["`results` não é lista", { results: "nada" }],
		[
			"coordenada como string",
			{ results: [{ latitude: "-3.9", longitude: -41.7 }] },
		],
		["coordenada ausente", { results: [{ latitude: -3.9 }] }],
		["nulo", null],
	])("devolve null para %s", (_caso, payload) => {
		// Sem coordenada o cabeçalho fica sem temperatura — melhor do que o tempo
		// de outra cidade com o nome da nossa ao lado.
		expect(parseCoordinates(payload)).toBeNull();
	});
});

describe("formatTemperature", () => {
	it("sem espaço antes do grau, como manda a norma para a unidade", () => {
		expect(formatTemperature(36)).toBe("36°C");
		expect(formatTemperature(0)).toBe("0°C");
		expect(formatTemperature(-5)).toBe("-5°C");
	});
});

function comTemperatura(temperature_2m: number) {
	return { current: { temperature_2m, weather_code: 1 } };
}
