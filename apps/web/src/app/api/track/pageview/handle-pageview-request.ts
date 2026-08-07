import type { PageViewLogPort, ViewCounterPort } from "@portal-app/analytics";
import { classifyTrafficSource } from "@portal-app/analytics";
import { z } from "zod";

/**
 * Núcleo da rota, separado do `route.ts` para ser testável por injeção — as
 * portas entram por parâmetro, como todo o resto do projeto (`Deps`), em vez
 * de mockar o módulo `@portal-app/api/analytics`.
 *
 * Dois beacons por leitura:
 *  1. na abertura — `{ viewId, slug, referrer }`: conta no Redis (mais lidas,
 *     Bloco 3) e abre a linha no log durável (insights, Bloco 4);
 *  2. na saída — `{ viewId, readingSeconds }`: fecha o tempo de leitura.
 *
 * O `viewId` é gerado no CLIENTE justamente porque `sendBeacon` é fire-and-
 * forget: não há resposta para o segundo beacon aproveitar, então o id
 * precisa existir antes do primeiro. Como as duas escritas são por id
 * (upsert/update), entregar o mesmo beacon duas vezes não duplica nada.
 *
 * `sendBeacon` manda `Content-Type: text/plain`, então o corpo chega como
 * texto puro — não dá para usar `request.json()` direto. Falha de
 * infraestrutura não pode virar erro visível para quem só queria ler a
 * matéria, por isso o catch devolve 204 de qualquer jeito.
 */
const OPEN_SCHEMA = z.object({
	viewId: z.string().min(1),
	slug: z.string().min(1),
	referrer: z.string().optional(),
});

const CLOSE_SCHEMA = z.object({
	viewId: z.string().min(1),
	// Teto de 1h: aba esquecida aberta a noite toda não é tempo de leitura, e
	// um outlier desses sozinho distorce a média da matéria inteira.
	readingSeconds: z.number().int().min(0).max(3600),
});

const BODY_SCHEMA = z.union([CLOSE_SCHEMA, OPEN_SCHEMA]);

export async function handlePageviewRequest(
	request: Request,
	deps: { counter: ViewCounterPort; log: PageViewLogPort },
): Promise<Response> {
	try {
		const raw = await request.text();
		const body = BODY_SCHEMA.parse(JSON.parse(raw));

		if ("readingSeconds" in body) {
			await deps.log.setReadingTime(body.viewId, body.readingSeconds);
		} else {
			const now = new Date();
			// O host vem da própria requisição: o mesmo portal roda em localhost,
			// em preview e em produção, e chumbar o domínio faria a navegação
			// interna de dev contar como tráfego externo.
			const ownHost = new URL(request.url).hostname;
			await Promise.all([
				deps.counter.recordView(body.slug, now),
				deps.log.record({
					id: body.viewId,
					articleSlug: body.slug,
					occurredAt: now,
					source: classifyTrafficSource(body.referrer, ownHost),
				}),
			]);
		}
	} catch (error) {
		console.warn("[track/pageview] falhou; ignorado de propósito:", error);
	}
	return new Response(null, { status: 204 });
}
