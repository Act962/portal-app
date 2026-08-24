import { err, ok, type Result } from "../result";

/**
 * Scheduler — porta que abstrai "quem dispara o trabalho recorrente" (ADR 0007).
 *
 * O ponto NÃO é agendar: é separar **o que roda** de **quem manda rodar**. A
 * aplicação declara a tarefa uma vez; qual agendador a dirige — o cron da
 * Vercel, um `node-cron` no VPS, uma função Inngest — vira escolha da raiz de
 * composição, trocável sem tocar em nada além do adapter.
 *
 * O modelo é de **tarefa recorrente idempotente**, e não de "execute isto às
 * 06:00". É o menor denominador comum entre os três agendadores, e o único que
 * sobrevive a um deles ficar fora do ar: quem perde uma rodada publica na
 * seguinte, porque a tarefa pergunta ao banco o que está vencido em vez de
 * confiar em ter sido acordada na hora exata. Um `step.sleepUntil` do Inngest
 * cumpriria o mesmo papel com menos latência, mas amarraria a semântica ao
 * provedor — que é justamente o que esta porta existe para evitar.
 */
export type ScheduledTask = {
	/**
	 * Identificador estável, em kebab-case. Não é rótulo: é o que vira segmento
	 * de URL no driver HTTP e id de função no Inngest. Mudá-lo quebra o
	 * agendamento configurado do lado de fora.
	 */
	name: string;

	/**
	 * Periodicidade em expressão cron de 5 campos, interpretada em **UTC**.
	 *
	 * Esta é a fonte da verdade da periodicidade para os adapters que a leem
	 * (`node-cron`, Inngest). O cron da Vercel é a exceção: ele lê o
	 * `vercel.json`, então lá a expressão precisa ser espelhada à mão — ver
	 * `docs/deploy.md` §3.
	 */
	cron: string;

	/** Para quem opera: o que esta tarefa faz e por que existe. */
	description: string;

	/**
	 * O trabalho. **Precisa ser idempotente**: todo agendador desta lista pode
	 * disparar duas vezes (retry da Vercel, reentrega do Inngest, duas
	 * instâncias com `node-cron`), e nenhum deles promete exatamente-uma-vez.
	 *
	 * O retorno é ecoado pelo driver (corpo da resposta HTTP, log do Inngest),
	 * então convém devolver algo serializável e legível — quantos itens foram
	 * processados, tipicamente.
	 *
	 * Se lançar, a exceção sobe para o driver de propósito: é ele quem sabe o
	 * que fazer com falha (status 500, retry com backoff, alerta). Repare no
	 * contraste com `run()` abaixo, que devolve `Result` para tarefa
	 * inexistente — aquilo é entrada inválida, isto é falha de execução.
	 */
	run: () => Promise<unknown>;
};

/** Pediram uma tarefa que não está registrada. */
export class UnknownTask {
	readonly _tag = "UnknownTask" as const;

	constructor(
		readonly name: string,
		readonly known: readonly string[],
	) {}
}

export interface Scheduler {
	/** Todas as tarefas registradas, na ordem de registro. */
	tasks(): readonly ScheduledTask[];

	/** A tarefa de um nome, ou `null`. */
	get(name: string): ScheduledTask | null;

	/** Executa a tarefa. `UnknownTask` quando o nome não existe. */
	run(name: string): Promise<Result<unknown, UnknownTask>>;
}

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CRON_FIELDS = 5;

/**
 * Registro em memória — e é a implementação de PRODUÇÃO, não um dublê.
 *
 * Não há o que persistir: a lista de tarefas é código, montada na raiz de
 * composição a cada boot. O estado durável de cada tarefa (o que já foi
 * publicado, o que sobrou no outbox) mora no banco, onde sempre morou.
 */
export class TaskRegistry implements Scheduler {
	private readonly registry = new Map<string, ScheduledTask>();

	/**
	 * Lança em vez de devolver `Result`, ao contrário do resto do kernel. É
	 * deliberado: registro acontece no boot, e nome duplicado ou malformado é
	 * erro de programação — quebrar na subida é melhor do que subir com uma
	 * tarefa que nunca vai ser chamada porque outra tomou o nome dela.
	 */
	register(task: ScheduledTask): void {
		if (!NAME_PATTERN.test(task.name)) {
			throw new Error(
				`Nome de tarefa inválido: "${task.name}". Use kebab-case — o nome vira segmento de URL e id de função.`,
			);
		}
		if (this.registry.has(task.name)) {
			throw new Error(`Tarefa "${task.name}" registrada duas vezes.`);
		}
		// Validação de forma, não de semântica: quem interpreta o cron é o
		// adapter, e cada um aceita extensões próprias. Aqui só se pega o erro
		// de digitação que passaria despercebido até a tarefa nunca rodar.
		if (task.cron.trim().split(/\s+/).length !== CRON_FIELDS) {
			throw new Error(
				`Cron de "${task.name}" precisa ter ${CRON_FIELDS} campos, veio "${task.cron}".`,
			);
		}

		this.registry.set(task.name, task);
	}

	tasks(): readonly ScheduledTask[] {
		return [...this.registry.values()];
	}

	get(name: string): ScheduledTask | null {
		return this.registry.get(name) ?? null;
	}

	async run(name: string): Promise<Result<unknown, UnknownTask>> {
		const task = this.registry.get(name);
		if (!task) {
			return err(new UnknownTask(name, [...this.registry.keys()]));
		}
		return ok(await task.run());
	}
}
