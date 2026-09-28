/**
 * Healthcheck do container (Dockerfile → `HEALTHCHECK`). O Coolify só troca o
 * container antigo pelo novo quando este responde 200.
 *
 * Não toca no banco de propósito: é a pergunta "o processo está de pé?". Um
 * banco fora do ar não se resolve reiniciando o app — e o portal já degrada
 * para vazio nesse caso (`safely`, em `data/read-model.ts`).
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
	return Response.json({ ok: true });
}
