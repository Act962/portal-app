import { describe, expect, it } from "vitest";

import { tableDate, tableDateTitle, tableRelative } from "@/lib/admin-dates";

/**
 * As datas da lista de matérias.
 *
 * O que se testa aqui é o que erra de verdade: o FUSO (a Vercel roda em UTC e
 * a redação não) e as fronteiras do texto relativo. O `now` entra por
 * parâmetro justamente para isto ser verificável sem congelar relógio.
 */

/** 08/09/2026, 11h32 em Piracuruca (UTC−3) = 14:32Z. */
const NOON = new Date("2026-09-08T14:32:00Z");

describe("tableDate", () => {
	it("formata no fuso da redação, não no do servidor", () => {
		expect(tableDate("2026-09-08T14:32:00Z")).toBe("08/09/26");
	});

	it("não empurra para o dia seguinte o que foi salvo à noite", () => {
		// 22h de Piracuruca é 01:00Z do dia 9 — em UTC a data já virou.
		expect(tableDate("2026-09-09T01:00:00Z")).toBe("08/09/26");
	});

	it("aceita Date e string, porque o tRPC devolve os dois", () => {
		expect(tableDate(new Date("2026-09-08T14:32:00Z"))).toBe("08/09/26");
	});

	it("devolve traço para data ausente ou ilegível", () => {
		expect(tableDate(null)).toBe("—");
		expect(tableDate(undefined)).toBe("—");
		expect(tableDate("nem data é")).toBe("—");
	});
});

describe("tableDateTitle", () => {
	it("traz o valor exato para o title da célula", () => {
		expect(tableDateTitle("2026-09-08T14:32:00Z")).toContain("setembro");
		expect(tableDateTitle("2026-09-08T14:32:00Z")).toContain("11:32");
	});

	it("é indefinido sem data — title com traço não informa nada", () => {
		expect(tableDateTitle(null)).toBeUndefined();
	});
});

describe("tableRelative", () => {
	it("chama de agora o que acabou de acontecer", () => {
		expect(tableRelative("2026-09-08T14:31:30Z", NOON)).toBe("agora");
	});

	it("conta minutos dentro da primeira hora", () => {
		expect(tableRelative("2026-09-08T14:20:00Z", NOON)).toBe("há 12 min");
	});

	it("abrevia a hora — a célula divide espaço com cinco colunas", () => {
		expect(tableRelative("2026-09-08T11:32:00Z", NOON)).toBe("há 3 h");
	});

	it("diz ontem em vez de há 1 dias", () => {
		expect(tableRelative("2026-09-07T14:32:00Z", NOON)).toBe("ontem");
	});

	it("conta dias até uma semana", () => {
		expect(tableRelative("2026-09-04T14:32:00Z", NOON)).toBe("há 4 dias");
	});

	it("volta para a data curta passada a semana — 'há 34 dias' não informa", () => {
		expect(tableRelative("2026-08-05T14:32:00Z", NOON)).toBe("05/08/26");
	});

	it("não mostra tempo negativo quando o relógio do cliente está adiantado", () => {
		expect(tableRelative("2026-09-08T15:00:00Z", NOON)).toBe("08/09/26");
	});

	it("devolve traço sem data", () => {
		expect(tableRelative(null, NOON)).toBe("—");
	});
});
