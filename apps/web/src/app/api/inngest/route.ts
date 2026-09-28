import { inngest, inngestFunctions } from "@portal-app/api/inngest";
import { serve } from "inngest/next";

/**
 * Endpoint que o Inngest usa para descobrir e executar as funções.
 *
 * O `PUT` é o que sincroniza: o Inngest bate aqui (no deploy, ou quando o Dev
 * Server descobre a app) e recebe a lista de funções com seus gatilhos. `POST`
 * é a execução de cada uma; `GET` é a introspecção.
 *
 * Não há autenticação nossa: quem assina e verifica as requisições é o SDK, com
 * a `INNGEST_SIGNING_KEY`. Em produção, **sem essa variável o endpoint recusa**
 * — é o mesmo princípio do `CRON_SECRET` na rota `/api/cron/[task]`.
 *
 * Sem `maxDuration`: ele só existia para a Vercel, que cortava a função no
 * teto. No Coolify o Next roda como processo Node de longa duração, e a
 * montagem de vídeo (spec 12) termina no tempo que levar — quem a limita é o
 * `RENDER_MAX_SECONDS` do domínio.
 */

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: inngestFunctions,
});
