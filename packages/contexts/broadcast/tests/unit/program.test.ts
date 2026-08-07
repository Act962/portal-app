import { describe, expect, it } from "vitest";

import {
	EndBeforeStart,
	HostRequired,
	InvalidDayOfWeek,
	InvalidTime,
	NameRequired,
	Program,
} from "../../src/index";

function novo(overrides: Partial<Parameters<typeof Program.create>[0]> = {}) {
	return Program.create({
		id: "prog-1",
		name: "Manhã 7 Cidades",
		host: "Léo Martins",
		dayOfWeek: 1,
		startTime: "06:00",
		endTime: "09:00",
		...overrides,
	});
}

describe("Program.create", () => {
	it("cria um programa válido", () => {
		const program = novo().unwrap();

		expect(program.name).toBe("Manhã 7 Cidades");
		expect(program.host).toBe("Léo Martins");
		expect(program.dayOfWeek).toBe(1);
		expect(program.startTime).toBe("06:00");
		expect(program.endTime).toBe("09:00");
		expect(program.order).toBe(0);
	});

	it("recusa nome vazio", () => {
		expect(novo({ name: "  " }).unwrapErr()).toBeInstanceOf(NameRequired);
	});

	it("recusa locutor vazio", () => {
		expect(novo({ host: " " }).unwrapErr()).toBeInstanceOf(HostRequired);
	});

	it.each([-1, 7, 1.5])("recusa dia da semana inválido: %s", (dayOfWeek) => {
		expect(novo({ dayOfWeek }).unwrapErr()).toBeInstanceOf(InvalidDayOfWeek);
	});

	it.each(["25:00", "06:60", "6:00", "manhã"])(
		"recusa horário fora do formato HH:MM: %s",
		(startTime) => {
			expect(novo({ startTime }).unwrapErr()).toBeInstanceOf(InvalidTime);
		},
	);

	it("recusa término igual ou antes do início", () => {
		expect(
			novo({ startTime: "09:00", endTime: "09:00" }).unwrapErr(),
		).toBeInstanceOf(EndBeforeStart);
		expect(
			novo({ startTime: "09:00", endTime: "06:00" }).unwrapErr(),
		).toBeInstanceOf(EndBeforeStart);
	});

	it("aceita order explícito", () => {
		expect(novo({ order: 3 }).unwrap().order).toBe(3);
	});
});

describe("Program.updateDetails", () => {
	it("edita só os campos informados", () => {
		const program = novo().unwrap();

		const result = program.updateDetails({ name: "Manhã Renovada" });

		expect(result.isOk()).toBe(true);
		expect(program.name).toBe("Manhã Renovada");
		expect(program.host).toBe("Léo Martins");
		expect(program.startTime).toBe("06:00");
	});

	it("recusa edição que deixaria o término antes do início", () => {
		const program = novo().unwrap();

		const result = program.updateDetails({ startTime: "10:00" });

		expect(result).toBeErr(EndBeforeStart);
		// Estado original preservado — a edição inválida não aplica parcial.
		expect(program.startTime).toBe("06:00");
	});
});

describe("Program.reorderTo", () => {
	it("troca a ordem de exibição", () => {
		const program = novo().unwrap();
		program.reorderTo(5);
		expect(program.order).toBe(5);
	});
});

describe("Program.isLiveAt", () => {
	const program = novo({ dayOfWeek: 2, startTime: "06:00", endTime: "09:00" }).unwrap();

	function at(day: number, hour: number, minute: number): Date {
		// 2026-08-04 é uma terça-feira (dayOfWeek 2) — base fixa para o teste não
		// depender de que dia é hoje.
		const base = new Date(2026, 7, 4 + (day - 2));
		base.setHours(hour, minute, 0, 0);
		return base;
	}

	it("está no ar exatamente no início (inclusivo)", () => {
		expect(program.isLiveAt(at(2, 6, 0))).toBe(true);
	});

	it("está no ar um minuto antes do fim", () => {
		expect(program.isLiveAt(at(2, 8, 59))).toBe(true);
	});

	it("não está mais no ar exatamente no horário de término (exclusivo)", () => {
		expect(program.isLiveAt(at(2, 9, 0))).toBe(false);
	});

	it("não está no ar antes do início", () => {
		expect(program.isLiveAt(at(2, 5, 59))).toBe(false);
	});

	it("não está no ar no dia errado, mesmo no mesmo horário", () => {
		expect(program.isLiveAt(at(3, 7, 0))).toBe(false);
	});
});
