import {
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import type {
	EndBeforeStart,
	HostRequired,
	InvalidDayOfWeek,
	InvalidTime,
	NameRequired,
} from "../domain/errors";
import { ProgramNotFound } from "../domain/errors";
import type { ProgramRepository } from "../domain/ports/program-repository";
import { Program } from "../domain/program";

/**
 * Casos de uso da programação. A AUTORIZAÇÃO fica na fronteira da API
 * (`requirePermission("broadcast:manage")`), não aqui — mesmo arranjo dos
 * demais contextos (`contextos-isolados`: este pacote não importa `identity`).
 */
type Deps = {
	repo: ProgramRepository;
	ids: IdGenerator;
};

type CreateInput = {
	name: string;
	host: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

type SaveError =
	| NameRequired
	| HostRequired
	| InvalidDayOfWeek
	| InvalidTime
	| EndBeforeStart;

export function listPrograms(deps: Pick<Deps, "repo">): Promise<Program[]> {
	return deps.repo.list();
}

export async function createProgram(
	input: CreateInput,
	deps: Deps,
): Promise<Result<Program, SaveError>> {
	// Novo programa entra no fim da ordenação atual (desempate manual, como as
	// editorias) — não afeta dia/horário, só o `order` de exibição.
	const order = (await deps.repo.list()).length;
	const created = Program.create({ id: deps.ids.generate(), order, ...input });
	if (created.isErr()) {
		return err(created.error);
	}
	await deps.repo.save(created.value);
	return created;
}

export async function updateProgram(
	input: {
		id: string;
		name?: string;
		host?: string;
		dayOfWeek?: number;
		startTime?: string;
		endTime?: string;
	},
	deps: Pick<Deps, "repo">,
): Promise<Result<Program, SaveError | ProgramNotFound>> {
	const program = await deps.repo.findById(input.id);
	if (!program) {
		return err(new ProgramNotFound(input.id));
	}
	const updated = program.updateDetails(input);
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.repo.save(program);
	return ok(program);
}

export async function deleteProgram(
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, ProgramNotFound>> {
	const program = await deps.repo.findById(input.id);
	if (!program) {
		return err(new ProgramNotFound(input.id));
	}
	await deps.repo.delete(program.id);
	return ok(undefined);
}

export async function reorderPrograms(
	input: { orders: ReadonlyArray<{ id: string; order: number }> },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, ProgramNotFound>> {
	for (const { id, order } of input.orders) {
		const program = await deps.repo.findById(id);
		if (!program) {
			return err(new ProgramNotFound(id));
		}
		program.reorderTo(order);
		await deps.repo.save(program);
	}
	return ok(undefined);
}
