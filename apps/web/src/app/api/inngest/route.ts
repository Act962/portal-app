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
/**
 * Quanto tempo a função pode rodar (spec 12).
 *
 * Os cinco minutos existem por causa do VÍDEO: montar o padrão sobre um Reels
 * é transcodificação, e leva dezenas de segundos. Com o teto padrão da Vercel,
 * a entrega morreria no meio, voltaria para a fila e tentaria de novo — para
 * morrer no mesmo lugar, para sempre.
 *
 * **Isto exige Fluid Compute ligado no projeto** (padrão nos projetos novos) ou
 * um plano que permita o valor; caso contrário o deploy falha dizendo qual é o
 * máximo. Ver docs/deploy.md §3. O teto do vídeo em si é outro e menor —
 * `RENDER_MAX_SECONDS`, 90 s de duração —, e é ele que garante que a montagem
 * caiba aqui com folga.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: inngestFunctions,
});
