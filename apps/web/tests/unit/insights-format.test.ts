import { describe, expect, it } from "vitest";

import {
	formatDayLabel,
	formatDuration,
	formatSource,
	rangeForDays,
} from "@/lib/insights-format";

describe("formatDuration", () => {
	it("abaixo de um minuto mostra segundos", () => {
		expect(formatDuration(45)).toBe("45s");
	});

	it("minuto exato não mostra os segundos", () => {
		expect(formatDuration(120)).toBe("2min");
	});

	it("minutos e segundos", () => {
		expect(formatDuration(95)).toBe("1min 35s");
	});

	it("sem medida vira travessão, não '0s'", () => {
		// "0s" mentiria: significa "ninguém foi medido", não "leram zero".
		expect(formatDuration(null)).toBe("—");
	});
});

describe("formatDayLabel", () => {
	it("converte ISO para o formato brasileiro curto", () => {
		expect(formatDayLabel("2026-08-06")).toBe("06/08");
	});
});

describe("formatSource", () => {
	it("traduz as origens conhecidas", () => {
		expect(formatSource("busca")).toBe("Busca");
		expect(formatSource("social")).toBe("Redes sociais");
	});

	it("origem desconhecida aparece crua, sem quebrar", () => {
		expect(formatSource("inventada")).toBe("inventada");
	});
});

describe("rangeForDays", () => {
	const now = new Date(2026, 7, 6, 15, 30, 0); // 06/08/2026, 15h30 local

	it("cobre o dia inteiro de hoje", () => {
		const { to } = rangeForDays(7, now);
		expect(to.getDate()).toBe(6);
		expect(to.getHours()).toBe(23);
		expect(to.getMinutes()).toBe(59);
	});

	it("7 dias inclui hoje — começa 6 dias atrás, não 7", () => {
		// Off-by-one aqui daria 8 pontos num gráfico rotulado "7 dias".
		const { from } = rangeForDays(7, now);
		expect(from.getDate()).toBe(31);
		expect(from.getMonth()).toBe(6); // julho
		expect(from.getHours()).toBe(0);
	});

	it("atravessa a virada de mês corretamente", () => {
		const primeiroDeMarco = new Date(2026, 2, 1, 12, 0, 0);
		const { from } = rangeForDays(3, primeiroDeMarco);

		expect(from.getMonth()).toBe(1); // fevereiro
		expect(from.getDate()).toBe(27);
	});

	it("um dia é só hoje", () => {
		const { from, to } = rangeForDays(1, now);
		expect(from.getDate()).toBe(6);
		expect(to.getDate()).toBe(6);
	});
});
