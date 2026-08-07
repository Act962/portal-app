import { publishDueScheduled } from "@portal-app/editorial";
import { TaskRegistry } from "@portal-app/shared-kernel";

import { articleDeps, dispatchEditorialEvents } from "./editorial";

/**
 * Raiz de composição do agendamento (ADR 0007).
 *
 * É AQUI que "o que roda" encontra "quem manda rodar", e é por isso que este
 * arquivo mora em `packages/api` e não num contexto: registrar uma tarefa
 * significa amarrar um caso de uso a dependências concretas, e essa cola é
 * exatamente o papel da raiz de composição.
 *
 * Trocar de agendador não passa por aqui. Este arquivo declara as tarefas; o
 * driver que as dispara é escolhido do lado de fora:
 *
 * - **Cron da Vercel** (o de hoje) — `vercel.json` bate na rota
 *   `/api/cron/[task]`, que resolve o nome neste registro.
 * - **`node-cron`** — no boot, `for (const t of scheduler.tasks())
 *   cron.schedule(t.cron, () => scheduler.run(t.name))`.
 * - **Inngest** — `scheduler.tasks().map((t) => inngest.createFunction(
 *   { id: t.name }, { cron: t.cron }, () => scheduler.run(t.name)))`.
 *
 * Nos três, a tarefa é a mesma linha de código. Nenhum contexto importa o
 * agendador, e o núcleo não sabe que ele existe.
 */
export const scheduler = new TaskRegistry();

scheduler.register({
	name: "publish-scheduled",
	// Espelhado à mão no `vercel.json` enquanto o driver for o cron da Vercel —
	// ele lê o arquivo, não este registro. Ver docs/deploy.md §3.
	cron: "*/5 * * * *",
	description:
		"Publica as matérias agendadas cujo horário já venceu (A13) e despacha os eventos resultantes.",
	run: async () => {
		const published = await publishDueScheduled(articleDeps);
		// Sem este despacho os eventos das matérias publicadas aqui ficariam
		// parados no outbox, e a auditoria não registraria a publicação. É o mesmo
		// despacho que roda depois de cada mutação editorial.
		await dispatchEditorialEvents();

		return {
			published: published.length,
			ids: published.map((article) => article.id),
		};
	},
});
