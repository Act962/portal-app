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
 * As duas rotas coexistem de propósito durante a transição: enquanto o Inngest
 * não estiver confirmado em produção, o cron da Vercel continua sendo a rede de
 * segurança. As tarefas são idempotentes, então disparar pelos dois caminhos
 * não duplica nada — ver docs/deploy.md §3.
 */
export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: inngestFunctions,
});
