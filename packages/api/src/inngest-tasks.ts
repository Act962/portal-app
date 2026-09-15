import type { Scheduler } from "@portal-app/shared-kernel";

export type InngestTrigger = { cron: string } | { event: string };

/**
 * O mínimo do cliente Inngest de que precisamos, declarado estruturalmente.
 *
 * Existe para que o teste possa passar um dublê sem arrastar o SDK — e, de
 * quebra, deixa explícito qual é a superfície do Inngest que este projeto usa:
 * `createFunction` e `send`, e nada mais. O dia em que a lista crescer, cresce
 * aqui, à vista.
 */
export type InngestFunctionFactory<TFunction> = {
	createFunction(
		options: {
			id: string;
			description?: string;
			triggers: InngestTrigger[];
			concurrency?: { limit: number };
		},
		handler: () => Promise<unknown>,
	): TFunction;
};

/**
 * Transforma cada tarefa registrada numa função Inngest (ADR 0007).
 *
 * É a tradução inteira do adapter: o `id` da função é o nome da tarefa, o
 * gatilho é o `cron` que ela declara e, se ela tiver `wakeOn`, também o evento
 * de mesmo nome. Nada é redigitado — mudar a periodicidade no registro muda o
 * agendamento no Inngest, sem um segundo lugar para esquecer (ao contrário do
 * cron da Vercel, que lê o `vercel.json`).
 *
 * `exclusive` vira `concurrency: { limit: 1 }`. O limite é da FUNÇÃO, e vale
 * para as execuções dos dois gatilhos juntos: a do cron e a do evento entram na
 * mesma fila, uma de cada vez — é o que impede a aprovação perto da virada do
 * cron de publicar o mesmo post duas vezes. Execuções a mais esperam; não são
 * descartadas.
 *
 * O handler chama `task.run()` direto, e não `scheduler.run(name)`, por dois
 * motivos: a tarefa já está em mãos (procurar pelo nome só poderia falhar), e o
 * `Result` do `scheduler.run` viraria ruído no log do Inngest.
 *
 * **A exceção sobe de propósito.** É ela que dispara o retry com backoff — a
 * única coisa que o Inngest traz e o cron da Vercel não. Engolir o erro aqui
 * transformaria a adoção do Inngest num placebo caro.
 */
export function createTaskFunctions<TFunction>(
	factory: InngestFunctionFactory<TFunction>,
	scheduler: Scheduler,
): TFunction[] {
	return scheduler.tasks().map((task) =>
		factory.createFunction(
			{
				id: task.name,
				description: task.description,
				triggers: task.wakeOn
					? [{ cron: task.cron }, { event: task.wakeOn }]
					: [{ cron: task.cron }],
				...(task.exclusive ? { concurrency: { limit: 1 } } : {}),
			},
			() => task.run(),
		),
	);
}

/** O `send` do cliente Inngest, no formato que usamos. */
export type InngestEventSender = {
	send(payload: {
		name: string;
		data: Record<string, unknown>;
	}): Promise<unknown>;
};

/**
 * Acorda uma tarefa agora. Devolve `true` se o sinal saiu.
 *
 * **Nunca lança.** Quem chama é uma mutação que já gravou o que importava (o
 * post aprovado), e uma falha AQUI — Inngest fora do ar, `INNGEST_EVENT_KEY`
 * ausente, Dev Server desligado — não pode virar erro na tela de quem aprovou.
 * O cron da tarefa é a rede de segurança: o trabalho sai na próxima rodada.
 */
export type TaskWaker = (
	name: string,
	data?: Record<string, unknown>,
) => Promise<boolean>;

export function createTaskWaker(
	sender: InngestEventSender,
	scheduler: Scheduler,
	log: (message: string) => void = (message) => console.warn(message),
): TaskWaker {
	return async (name, data = {}) => {
		const task = scheduler.get(name);
		if (!task?.wakeOn) {
			// Erro de programação (nome errado, tarefa sem sinal). Logado, e não
			// lançado, pelo mesmo motivo do cabeçalho.
			log(
				`[scheduler] "${name}" não é uma tarefa acordável — ela roda só no cron.`,
			);
			return false;
		}
		try {
			await sender.send({ name: task.wakeOn, data });
			return true;
		} catch (error) {
			log(
				`[scheduler] não foi possível acordar "${name}" agora (${error instanceof Error ? error.message : String(error)}); ela roda na próxima rodada do cron.`,
			);
			return false;
		}
	};
}
