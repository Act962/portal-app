import { describe, expect, it } from "vitest";

import {
	averageReadingTimeByArticle,
	overallAverageReadingSeconds,
	type PageViewRecord,
	viewsByDay,
	viewsBySource,
} from "../../src/index";

const TZ = "America/Sao_Paulo";

function view(overrides: Partial<PageViewRecord> = {}): PageViewRecord {
	return {
		articleSlug: "materia-a",
		occurredAt: new Date("2026-08-05T15:00:00-03:00"),
		readingSeconds: 60,
		source: "direto",
		...overrides,
	};
}

describe("viewsByDay", () => {
	it("conta as visualizações de cada dia", () => {
		const records = [
			view({ occurredAt: new Date("2026-08-05T10:00:00-03:00") }),
			view({ occurredAt: new Date("2026-08-05T18:00:00-03:00") }),
			view({ occurredAt: new Date("2026-08-06T09:00:00-03:00") }),
		];

		const result = viewsByDay(
			records,
			{
				from: new Date("2026-08-05T00:00:00-03:00"),
				to: new Date("2026-08-06T23:59:59-03:00"),
			},
			TZ,
		);

		expect(result).toEqual([
			{ day: "2026-08-05", views: 2 },
			{ day: "2026-08-06", views: 1 },
		]);
	});

	it("dia sem visualização aparece com zero, não some do gráfico", () => {
		const records = [view({ occurredAt: new Date("2026-08-07T10:00:00-03:00") })];

		const result = viewsByDay(
			records,
			{
				from: new Date("2026-08-05T00:00:00-03:00"),
				to: new Date("2026-08-07T23:59:59-03:00"),
			},
			TZ,
		);

		expect(result).toEqual([
			{ day: "2026-08-05", views: 0 },
			{ day: "2026-08-06", views: 0 },
			{ day: "2026-08-07", views: 1 },
		]);
	});

	it("agrupa pelo fuso da redação, não pelo UTC do servidor", () => {
		// 22h de Teresina no dia 5 = 01h UTC do dia 6. Agrupado em UTC, esta
		// visita cairia no dia 6 e o movimento da noite iria para o dia errado.
		const records = [view({ occurredAt: new Date("2026-08-06T01:00:00Z") })];

		const result = viewsByDay(
			records,
			{
				from: new Date("2026-08-05T00:00:00-03:00"),
				to: new Date("2026-08-05T23:59:59-03:00"),
			},
			TZ,
		);

		expect(result).toEqual([{ day: "2026-08-05", views: 1 }]);
	});

	it("intervalo de um único dia devolve um ponto só", () => {
		const result = viewsByDay(
			[],
			{
				from: new Date("2026-08-05T00:00:00-03:00"),
				to: new Date("2026-08-05T23:59:59-03:00"),
			},
			TZ,
		);

		expect(result).toEqual([{ day: "2026-08-05", views: 0 }]);
	});
});

describe("viewsBySource", () => {
	it("conta por origem", () => {
		const records = [
			view({ source: "busca" }),
			view({ source: "busca" }),
			view({ source: "social" }),
		];

		const result = viewsBySource(records);

		expect(result).toContainEqual({ source: "busca", views: 2 });
		expect(result).toContainEqual({ source: "social", views: 1 });
	});

	it("origem sem nenhuma visita aparece zerada — a ausência é informação", () => {
		const result = viewsBySource([view({ source: "direto" })]);

		expect(result).toContainEqual({ source: "social", views: 0 });
		// Todas as cinco categorias, sempre.
		expect(result).toHaveLength(5);
	});

	// A coluna `source` no banco é `String`, não enum: uma linha antiga, uma
	// migração futura ou um insert manual podem trazer valor fora da lista. O
	// gráfico ignora o desconhecido em vez de inventar uma sexta barra — e, acima
	// de tudo, não quebra o painel inteiro por causa de uma linha torta.
	it("origem desconhecida vinda do banco não vira categoria nem derruba a conta", () => {
		const records = [
			view({ source: "direto" }),
			view({ source: "telepatia" as never }),
		];

		const result = viewsBySource(records);

		expect(result).toHaveLength(5);
		expect(result).toContainEqual({ source: "direto", views: 1 });
		expect(result.some((row) => row.source === ("telepatia" as never))).toBe(
			false,
		);
	});
});

describe("averageReadingTimeByArticle", () => {
	it("calcula a média por matéria e ordena da maior para a menor", () => {
		const records = [
			view({ articleSlug: "curta", readingSeconds: 30 }),
			view({ articleSlug: "curta", readingSeconds: 50 }),
			view({ articleSlug: "longa", readingSeconds: 300 }),
		];

		expect(averageReadingTimeByArticle(records)).toEqual([
			{ articleSlug: "longa", views: 1, averageSeconds: 300 },
			{ articleSlug: "curta", views: 2, averageSeconds: 40 },
		]);
	});

	it("visualização sem medida fica FORA da média, não conta como zero", () => {
		// Contar o nulo como zero faria a média cair para 60 e toda matéria
		// pareceria mal lida por causa de quem fechou a aba rápido.
		const records = [
			view({ articleSlug: "a", readingSeconds: 120 }),
			view({ articleSlug: "a", readingSeconds: null }),
		];

		expect(averageReadingTimeByArticle(records)).toEqual([
			{ articleSlug: "a", views: 1, averageSeconds: 120 },
		]);
	});

	it("matéria só com visualizações sem medida não aparece", () => {
		const records = [view({ articleSlug: "a", readingSeconds: null })];
		expect(averageReadingTimeByArticle(records)).toEqual([]);
	});

	it("sem registro nenhum devolve lista vazia", () => {
		expect(averageReadingTimeByArticle([])).toEqual([]);
	});
});

describe("overallAverageReadingSeconds", () => {
	it("média geral ignora as visualizações sem medida", () => {
		const records = [
			view({ readingSeconds: 100 }),
			view({ readingSeconds: 200 }),
			view({ readingSeconds: null }),
		];

		expect(overallAverageReadingSeconds(records)).toBe(150);
	});

	it("sem nenhuma medida devolve null — a tela decide o que mostrar", () => {
		expect(overallAverageReadingSeconds([view({ readingSeconds: null })])).toBeNull();
		expect(overallAverageReadingSeconds([])).toBeNull();
	});
});
