import { describe, expect, it } from "vitest";

import { formatLongDate, formatRelativeTime } from "@/lib/format";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * Este módulo já quebrou DUAS vezes em produção, sempre pelo mesmo motivo: uma
 * data medida contra um instante congelado das fixtures em vez do relógio. A
 * primeira vez fez toda matéria aparecer como "há 1 min"; a segunda deixou o
 * cabeçalho do portal parado em 3 de agosto. Não é um módulo trivial — é um
 * módulo que engana, porque o erro passa no build, passa no tipo, e só aparece
 * para o leitor.
 *
 * Os dois casos de fumaça abaixo cobrem exatamente esse par de defeitos.
 */
describe("format", () => {
	it("mede o tempo relativo contra o relógio injetado, não contra um fixo", () => {
		const now = new Date("2026-08-06T12:00:00-03:00");
		const duasHorasAntes = "2026-08-06T10:00:00-03:00";

		expect(formatRelativeTime(duasHorasAntes, now)).toBe("há 2 horas");
	});

	it("formata a data longa no fuso da redação, não no do servidor", () => {
		// 23h em Brasília = 02h do dia SEGUINTE em UTC. Se a formatação usasse o
		// fuso do servidor (a Vercel roda em UTC), o cabeçalho viraria o dia antes
		// da hora e mostraria "7 de agosto" para quem ainda está no dia 6.
		const noiteDeSeis = new Date("2026-08-07T02:00:00Z");

		expect(formatLongDate(noiteDeSeis)).toContain("6 DE AGOSTO DE 2026");
	});

	// --- formatRelativeTime --------------------------------------------------
	it.todo("'há 1 min' é o piso — nada aparece como 'há 0 min'");
	it.todo("singular e plural: 'há 1 hora' vs 'há 2 horas'");
	it.todo("'ontem' em vez de 'há 1 dia'");
	it.todo("acima de um dia conta em dias");

	// --- formatByline / formatClock ------------------------------------------
	it.todo(
		"formatByline remove os conectores 'de' do pt-BR e sobe para caixa alta",
	);
	it.todo("formatClock devolve a hora no fuso da redação");

	// --- formatLongDate ------------------------------------------------------
	it.todo("remove o sufixo '-feira' do dia da semana");

	// --- formatCompactNumber --------------------------------------------------
	it.todo("1200 vira '1,2 mil'");
});
