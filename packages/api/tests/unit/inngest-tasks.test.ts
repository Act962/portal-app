import { TaskRegistry } from "@portal-app/shared-kernel";
import { describe, expect, it, vi } from "vitest";

import {
	createTaskFunctions,
	createTaskWaker,
	type InngestFunctionFactory,
	type InngestTrigger,
} from "../../src/inngest-tasks";

/**
 * Dublê do cliente Inngest: registra o que teria sido criado, sem SDK e sem
 * rede. É o que permite testar a tradução — que é a única lógica do adapter.
 */
type Criada = {
	options: {
		id: string;
		description?: string;
		triggers: InngestTrigger[];
		concurrency?: { limit: number };
	};
	handler: () => Promise<unknown>;
};

function fakeInngest(): InngestFunctionFactory<Criada> & { criadas: Criada[] } {
	const criadas: Criada[] = [];
	return {
		criadas,
		createFunction(options, handler) {
			const criada = { options, handler };
			criadas.push(criada);
			return criada;
		},
	};
}

function registryCom(
	...tarefas: Array<{
		name: string;
		cron: string;
		wakeOn?: string;
		exclusive?: boolean;
		run?: () => Promise<unknown>;
	}>
): TaskRegistry {
	const registry = new TaskRegistry();
	for (const t of tarefas) {
		registry.register({
			name: t.name,
			cron: t.cron,
			wakeOn: t.wakeOn,
			exclusive: t.exclusive,
			description: `Descrição de ${t.name}.`,
			run: t.run ?? (async () => null),
		});
	}
	return registry;
}

describe("createTaskFunctions", () => {
	it("cria uma função por tarefa registrada", () => {
		const inngest = fakeInngest();
		const registry = registryCom(
			{ name: "publish-scheduled", cron: "*/5 * * * *" },
			{ name: "limpar-sessoes", cron: "0 4 * * *" },
		);

		const funcoes = createTaskFunctions(inngest, registry);

		expect(funcoes).toHaveLength(2);
		expect(inngest.criadas.map((c) => c.options.id)).toEqual([
			"publish-scheduled",
			"limpar-sessoes",
		]);
	});

	// O id da função é o que o Inngest usa para versionar e para amarrar o
	// histórico de execuções. Se ele deixasse de ser o nome da tarefa, renomear
	// uma tarefa criaria uma função órfã no painel em vez de continuar a mesma.
	it("usa o nome da tarefa como id, sem prefixo nem transformação", () => {
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({ name: "publish-scheduled", cron: "*/5 * * * *" }),
		);

		expect(inngest.criadas[0]?.options.id).toBe("publish-scheduled");
	});

	// O ponto do adapter: a periodicidade tem UMA fonte. Se o cron fosse
	// redigitado aqui, voltaríamos ao problema do `vercel.json` — dois lugares
	// para mudar e nenhum aviso quando divergem.
	it("propaga o cron declarado na tarefa, sem redigitar", () => {
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({ name: "diaria", cron: "0 6 * * 1-5" }),
		);

		expect(inngest.criadas[0]?.options.triggers).toEqual([
			{ cron: "0 6 * * 1-5" },
		]);
	});

	it("tarefa sem sinal não ganha limite de concorrência", () => {
		const inngest = fakeInngest();
		createTaskFunctions(
			inngest,
			registryCom({ name: "diaria", cron: "0 6 * * *" }),
		);
		expect(inngest.criadas[0]?.options).not.toHaveProperty("concurrency");
	});

	it("tarefa acordável ganha o evento como SEGUNDO gatilho, mantendo o cron", () => {
		// O cron é a rede de segurança: sem ele, um evento perdido deixaria o post
		// parado para sempre.
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({
				name: "publish-social",
				cron: "*/5 * * * *",
				wakeOn: "social/post.approved",
				exclusive: true,
			}),
		);

		expect(inngest.criadas[0]?.options.triggers).toEqual([
			{ cron: "*/5 * * * *" },
			{ event: "social/post.approved" },
		]);
	});

	it("exclusive vira concorrência 1 — a execução do evento e a do cron não rodam juntas", () => {
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({
				name: "publish-social",
				cron: "*/5 * * * *",
				wakeOn: "social/post.approved",
				exclusive: true,
			}),
		);

		expect(inngest.criadas[0]?.options.concurrency).toEqual({ limit: 1 });
	});

	it("leva a descrição para o painel do Inngest", () => {
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({ name: "diaria", cron: "0 6 * * *" }),
		);

		expect(inngest.criadas[0]?.options.description).toBe(
			"Descrição de diaria.",
		);
	});

	it("o handler executa a tarefa e devolve o resultado dela", async () => {
		const inngest = fakeInngest();
		const run = vi.fn(async () => ({ published: 2 }));

		createTaskFunctions(
			inngest,
			registryCom({ name: "diaria", cron: "0 6 * * *", run }),
		);

		expect(run).not.toHaveBeenCalled(); // só no disparo, não no registro
		await expect(inngest.criadas[0]?.handler()).resolves.toEqual({
			published: 2,
		});
		expect(run).toHaveBeenCalledTimes(1);
	});

	// É a exceção que dispara o retry com backoff — a única coisa que o Inngest
	// traz e o cron da Vercel não. Engolir o erro aqui tornaria a adoção do
	// Inngest um placebo.
	it("deixa a falha da tarefa subir, para o Inngest reprocessar", async () => {
		const inngest = fakeInngest();

		createTaskFunctions(
			inngest,
			registryCom({
				name: "diaria",
				cron: "0 6 * * *",
				run: async () => {
					throw new Error("banco fora do ar");
				},
			}),
		);

		await expect(inngest.criadas[0]?.handler()).rejects.toThrow(
			"banco fora do ar",
		);
	});

	it("registro vazio não cria função nenhuma", () => {
		const inngest = fakeInngest();

		expect(createTaskFunctions(inngest, new TaskRegistry())).toEqual([]);
		expect(inngest.criadas).toHaveLength(0);
	});
});

describe("createTaskWaker", () => {
	const acordavel = () =>
		registryCom(
			{
				name: "publish-social",
				cron: "*/5 * * * *",
				wakeOn: "social/post.approved",
				exclusive: true,
			},
			{ name: "diaria", cron: "0 6 * * *" },
		);

	it("manda o evento da tarefa, com os dados", async () => {
		const send = vi.fn(async () => ({ ids: ["1"] }));
		const wake = createTaskWaker({ send }, acordavel(), () => {});

		expect(await wake("publish-social", { postId: "p-1" })).toBe(true);
		expect(send).toHaveBeenCalledWith({
			name: "social/post.approved",
			data: { postId: "p-1" },
		});
	});

	it("sem dados, manda um objeto vazio", async () => {
		const send = vi.fn(async () => null);
		await createTaskWaker({ send }, acordavel(), () => {})("publish-social");
		expect(send).toHaveBeenCalledWith({
			name: "social/post.approved",
			data: {},
		});
	});

	it("falha no envio NÃO lança — a aprovação já foi gravada e o cron cobre", async () => {
		const log = vi.fn();
		const wake = createTaskWaker(
			{
				send: async () => {
					throw new Error("Failed to send event: missing event key");
				},
			},
			acordavel(),
			log,
		);

		await expect(wake("publish-social")).resolves.toBe(false);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("próxima rodada do cron"),
		);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("missing event key"),
		);
	});

	it("falha com valor que não é Error também é logada", async () => {
		const log = vi.fn();
		const wake = createTaskWaker(
			{
				send: () => Promise.reject("fora do ar"),
			},
			acordavel(),
			log,
		);
		expect(await wake("publish-social")).toBe(false);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("fora do ar"));
	});

	it("tarefa sem sinal ou inexistente: não manda nada e avisa no log", async () => {
		const send = vi.fn(async () => null);
		const log = vi.fn();
		const wake = createTaskWaker({ send }, acordavel(), log);

		expect(await wake("diaria")).toBe(false);
		expect(await wake("nao-existe")).toBe(false);
		expect(send).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledTimes(2);
	});

	it("o log padrão é console.warn", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			await createTaskWaker({ send: async () => null }, acordavel())("diaria");
			expect(warn).toHaveBeenCalledOnce();
		} finally {
			warn.mockRestore();
		}
	});
});
