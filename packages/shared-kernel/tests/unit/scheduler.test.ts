import { describe, expect, it, vi } from "vitest";

import { TaskRegistry, UnknownTask } from "../../src/index";

function tarefa(overrides: Partial<Parameters<TaskRegistry["register"]>[0]> = {}) {
	return {
		name: "publicar-agendadas",
		cron: "*/5 * * * *",
		description: "Publica o que venceu.",
		run: async () => ({ published: 0 }),
		...overrides,
	};
}

describe("TaskRegistry.register", () => {
	it("guarda a tarefa e a devolve na ordem de registro", () => {
		const registry = new TaskRegistry();

		registry.register(tarefa({ name: "primeira" }));
		registry.register(tarefa({ name: "segunda" }));

		expect(registry.tasks().map((t) => t.name)).toEqual(["primeira", "segunda"]);
	});

	// O nome vira segmento de URL e id de função no agendador externo. Um nome
	// com espaço ou maiúscula passaria no registro e só quebraria em produção,
	// na hora em que a tarefa deveria rodar — que é quando ninguém está olhando.
	it.each(["Publicar", "publicar agendadas", "publicar_agendadas", "-publicar", ""])(
		"recusa nome fora do kebab-case: %s",
		(name) => {
			const registry = new TaskRegistry();

			expect(() => registry.register(tarefa({ name }))).toThrow(/inválido/);
		},
	);

	it("recusa nome duplicado — a segunda tomaria o lugar da primeira em silêncio", () => {
		const registry = new TaskRegistry();
		registry.register(tarefa({ name: "duplicada" }));

		expect(() => registry.register(tarefa({ name: "duplicada" }))).toThrow(
			/duas vezes/,
		);
	});

	it.each(["* * * *", "*/5 * * * * *", ""])(
		"recusa cron que não tem 5 campos: %s",
		(cron) => {
			const registry = new TaskRegistry();

			expect(() => registry.register(tarefa({ cron }))).toThrow(/5 campos/);
		},
	);

	it("aceita cron com espaçamento irregular — só a contagem de campos importa", () => {
		const registry = new TaskRegistry();

		expect(() =>
			registry.register(tarefa({ cron: "  */5   *  * * *  " })),
		).not.toThrow();
	});
});

describe("TaskRegistry.run", () => {
	it("executa a tarefa e devolve o que ela retornou", async () => {
		const registry = new TaskRegistry();
		registry.register(tarefa({ run: async () => ({ published: 3 }) }));

		const result = await registry.run("publicar-agendadas");

		expect(result.unwrap()).toEqual({ published: 3 });
	});

	it("tarefa inexistente é ERRO DE VALOR, não exceção — e diz quais existem", async () => {
		const registry = new TaskRegistry();
		registry.register(tarefa({ name: "publicar-agendadas" }));

		const result = await registry.run("publicar-agendada");

		const error = result.unwrapErr();
		expect(error).toBeInstanceOf(UnknownTask);
		expect(error.name).toBe("publicar-agendada");
		// O nome parecido é o caso comum (erro de digitação no agendador externo);
		// devolver a lista é o que transforma um 404 mudo em diagnóstico.
		expect(error.known).toEqual(["publicar-agendadas"]);
	});

	// Contraste deliberado com o caso acima: nome errado é entrada inválida e vira
	// `Result`; falha DENTRO da tarefa sobe, porque quem decide entre 500, retry
	// com backoff e alerta é o driver — não o registro.
	it("deixa a exceção da tarefa subir para o driver", async () => {
		const registry = new TaskRegistry();
		registry.register(
			tarefa({
				run: async () => {
					throw new Error("banco fora do ar");
				},
			}),
		);

		await expect(registry.run("publicar-agendadas")).rejects.toThrow(
			"banco fora do ar",
		);
	});

	it("não executa nada quando o nome não bate", async () => {
		const registry = new TaskRegistry();
		const run = vi.fn(async () => null);
		registry.register(tarefa({ run }));

		await registry.run("outra-coisa");

		expect(run).not.toHaveBeenCalled();
	});
});

describe("TaskRegistry.get", () => {
	it("devolve a tarefa pelo nome, e null quando não existe", () => {
		const registry = new TaskRegistry();
		registry.register(tarefa());

		expect(registry.get("publicar-agendadas")?.cron).toBe("*/5 * * * *");
		expect(registry.get("inexistente")).toBeNull();
	});
});
