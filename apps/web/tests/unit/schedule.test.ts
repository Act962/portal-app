import { describe, expect, it } from "vitest";

import type { ProgramRow } from "@/data/queries";
import { isProgramLive, programsForDay } from "@/lib/schedule";

function program(overrides: Partial<ProgramRow> = {}): ProgramRow {
	return {
		id: "manha-7-cidades",
		name: "Manhã 7 Cidades",
		host: "Léo Martins",
		dayOfWeek: 2,
		startTime: "06:00",
		endTime: "09:00",
		...overrides,
	};
}

/** 2026-08-04 é terça-feira (dayOfWeek 2) — base fixa para não depender de hoje. */
function at(dayOfWeek: number, hour: number, minute: number): Date {
	const date = new Date(2026, 7, 4 + (dayOfWeek - 2));
	date.setHours(hour, minute, 0, 0);
	return date;
}

describe("isProgramLive", () => {
	it("está no ar exatamente no início (inclusivo)", () => {
		expect(isProgramLive(program(), at(2, 6, 0))).toBe(true);
	});

	it("está no ar um minuto antes do fim", () => {
		expect(isProgramLive(program(), at(2, 8, 59))).toBe(true);
	});

	it("não está mais no ar no horário de término exato (exclusivo)", () => {
		expect(isProgramLive(program(), at(2, 9, 0))).toBe(false);
	});

	it("não está no ar antes do início", () => {
		expect(isProgramLive(program(), at(2, 5, 59))).toBe(false);
	});

	it("não está no ar no dia errado, mesmo no mesmo horário", () => {
		expect(isProgramLive(program(), at(3, 7, 0))).toBe(false);
	});
});

describe("programsForDay", () => {
	it("filtra só os programas do dia informado", () => {
		const segunda = program({ id: "a", dayOfWeek: 1 });
		const terca = program({ id: "b", dayOfWeek: 2 });

		expect(programsForDay([segunda, terca], 2)).toEqual([terca]);
	});

	it("dia sem programa devolve lista vazia", () => {
		expect(programsForDay([program({ dayOfWeek: 1 })], 0)).toEqual([]);
	});
});
