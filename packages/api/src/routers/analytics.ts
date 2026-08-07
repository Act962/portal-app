import {
	averageReadingTimeByArticle,
	overallAverageReadingSeconds,
	viewsByDay,
	viewsBySource,
} from "@portal-app/analytics";
import { z } from "zod";

import { pageViewLog } from "../analytics";
import { articleProductionBetween } from "../editorial";
import { requirePermission, router } from "../index";

/**
 * Painel de insights (A38). Tudo atrás de `analytics:view` — ADMIN e EDITOR
 * (ver `authorization.ts`: é insumo de pauta, não de governança).
 *
 * Fuso da redação fixo: o portal é de Teresina, e agrupar a série diária em
 * UTC jogaria o movimento da noite para o dia seguinte.
 */
const TIME_ZONE = "America/Sao_Paulo";

const view = requirePermission("analytics:view");

const RANGE = z.object({
	/** ISO-8601. Ambas as pontas são inclusivas. */
	from: z.string(),
	to: z.string(),
});

export const analyticsRouter = router({
	summary: view.input(RANGE).query(async ({ input }) => {
		const from = new Date(input.from);
		const to = new Date(input.to);

		const [records, production] = await Promise.all([
			pageViewLog.listBetween(from, to),
			articleProductionBetween(from, to),
		]);

		const topReadingTime = averageReadingTimeByArticle(records);

		return {
			totalViews: records.length,
			averageReadingSeconds: overallAverageReadingSeconds(records),
			viewsByDay: viewsByDay(records, { from, to }, TIME_ZONE),
			viewsBySource: viewsBySource(records),
			// 10 já enche a tabela da tela; a lista inteira seria ruído.
			readingTimeByArticle: topReadingTime.slice(0, 10),
			production,
		};
	}),
});
