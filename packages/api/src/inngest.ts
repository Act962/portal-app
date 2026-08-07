import { Inngest } from "inngest";

import { createTaskFunctions } from "./inngest-tasks";
import { scheduler } from "./scheduler";

/**
 * Adapter Inngest da porta `Scheduler` (ADR 0007).
 *
 * Este arquivo INTEIRO é o acoplamento ao Inngest — é o que a ADR prometia
 * quando disse "o Inngest é apenas um adapter". Abandoná-lo é apagar este
 * arquivo e a rota que o serve; nenhum contexto, caso de uso ou agregado sabe
 * que ele existe, e o `dependency-cruiser` garante que continue assim.
 *
 * O `id` identifica a APLICAÇÃO no painel do Inngest e não deve mudar entre
 * deploys — mudá-lo cria um app novo lá, e o histórico das execuções fica no
 * antigo.
 *
 * As credenciais (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) são lidas do
 * ambiente pelo próprio SDK. Sem elas, em desenvolvimento, o cliente fala com o
 * Dev Server local (`pnpm dev:inngest`) — nenhuma conta é necessária para rodar
 * o projeto, que é a regra do ADR 0008.
 */
export const inngest = new Inngest({ id: "portal-app" });

/**
 * Uma função por tarefa registrada. Registrar tarefa nova em `scheduler.ts`
 * basta: ela aparece aqui sozinha, e no próximo deploy o Inngest a sincroniza.
 */
export const inngestFunctions = createTaskFunctions(inngest, scheduler);
