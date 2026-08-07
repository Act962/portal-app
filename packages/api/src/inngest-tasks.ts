import type { Scheduler } from "@portal-app/shared-kernel";

/**
 * O mínimo do cliente Inngest de que precisamos, declarado estruturalmente.
 *
 * Existe para que o teste possa passar um dublê sem arrastar o SDK — e, de
 * quebra, deixa explícito qual é a superfície do Inngest que este projeto usa:
 * `createFunction` e nada mais. O dia em que a lista crescer, cresce aqui, à
 * vista.
 */
export type InngestFunctionFactory<TFunction> = {
	createFunction(
		options: {
			id: string;
			description?: string;
			triggers: Array<{ cron: string }>;
		},
		handler: () => Promise<unknown>,
	): TFunction;
};

/**
 * Transforma cada tarefa registrada numa função Inngest (ADR 0007).
 *
 * É a tradução inteira do adapter: o `id` da função é o nome da tarefa e o
 * gatilho é o `cron` que ela declara. Nada é redigitado — mudar a periodicidade
 * no registro muda o agendamento no Inngest, sem um segundo lugar para esquecer
 * (ao contrário do cron da Vercel, que lê o `vercel.json`).
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
				triggers: [{ cron: task.cron }],
			},
			() => task.run(),
		),
	);
}
