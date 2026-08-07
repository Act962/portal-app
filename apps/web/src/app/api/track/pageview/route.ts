import { pageViewLog, viewCounter } from "@portal-app/api/analytics";

import { handlePageviewRequest } from "./handle-pageview-request";

/**
 * Ingestão de pageview (P05/A38). Rota dedicada, fora do tRPC — o
 * `ViewTracker` dispara depois que a página já renderizou, então nada aqui
 * pode custar tempo de resposta da matéria em si. A lógica mora em
 * `handle-pageview-request.ts`, testável por injeção; este arquivo só liga as
 * implementações de verdade.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	return handlePageviewRequest(request, {
		counter: viewCounter,
		log: pageViewLog,
	});
}
