import {
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import { Columnist } from "../domain/columnist";
import {
	ColumnistNotFound,
	type InvalidSlug,
	type NameRequired,
	SlugTaken,
} from "../domain/errors";
import type { ColumnistRepository } from "../domain/ports/columnist-repository";
import { Slug } from "../domain/slug";

/**
 * Casos de uso dos colunistas. A AUTORIZAÇÃO fica na fronteira da API
 * (`requirePermission("columnists:manage")`), não aqui — mesmo arranjo dos
 * demais contextos (`contextos-isolados`: este pacote não importa `identity`).
 */
type Deps = {
	repo: ColumnistRepository;
	ids: IdGenerator;
};

type CreateInput = {
	name: string;
	slug?: string;
	beat?: string;
	blurb?: string;
	photoMediaId?: string | null;
};

export function listColumnists(deps: Pick<Deps, "repo">): Promise<Columnist[]> {
	return deps.repo.list();
}

export async function createColumnist(
	input: CreateInput,
	deps: Deps,
): Promise<Result<Columnist, NameRequired | InvalidSlug | SlugTaken>> {
	// Novo colunista entra no fim do bloco (desempate manual, como a grade e as
	// editorias).
	const order = (await deps.repo.list()).length;
	const created = Columnist.create({
		id: deps.ids.generate(),
		order,
		...input,
	});
	if (created.isErr()) {
		return err(created.error);
	}

	// A checagem vem DEPOIS do agregado porque só ele sabe normalizar o slug:
	// "Mariano Wikolí" e "mariano wikoli" viram o mesmo endereço, e comparar as
	// strings cruas deixaria os dois passarem.
	const existing = await deps.repo.findBySlug(created.value.slug);
	if (existing) {
		return err(new SlugTaken(created.value.slug));
	}

	await deps.repo.save(created.value);
	return created;
}

export async function updateColumnist(
	input: {
		id: string;
		name?: string;
		beat?: string;
		blurb?: string;
		photoMediaId?: string | null;
	},
	deps: Pick<Deps, "repo">,
): Promise<Result<Columnist, NameRequired | ColumnistNotFound>> {
	const columnist = await deps.repo.findById(input.id);
	if (!columnist) {
		return err(new ColumnistNotFound(input.id));
	}
	const updated = columnist.updateDetails(input);
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.repo.save(columnist);
	return ok(columnist);
}

export async function deleteColumnist(
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, ColumnistNotFound>> {
	const columnist = await deps.repo.findById(input.id);
	if (!columnist) {
		return err(new ColumnistNotFound(input.id));
	}
	await deps.repo.delete(columnist.id);
	return ok(undefined);
}

export async function setColumnistActive(
	input: { id: string; active: boolean },
	deps: Pick<Deps, "repo">,
): Promise<Result<Columnist, ColumnistNotFound>> {
	const columnist = await deps.repo.findById(input.id);
	if (!columnist) {
		return err(new ColumnistNotFound(input.id));
	}
	if (input.active) {
		columnist.activate();
	} else {
		columnist.deactivate();
	}
	await deps.repo.save(columnist);
	return ok(columnist);
}

export async function reorderColumnists(
	input: { orders: ReadonlyArray<{ id: string; order: number }> },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, ColumnistNotFound>> {
	for (const { id, order } of input.orders) {
		const columnist = await deps.repo.findById(id);
		if (!columnist) {
			return err(new ColumnistNotFound(id));
		}
		columnist.reorderTo(order);
		await deps.repo.save(columnist);
	}
	return ok(undefined);
}

/**
 * O slug que uma assinatura teria — sem gravar nada.
 *
 * Existe para a TELA poder avisar de assinatura repetida antes de enviar (o
 * servidor segue sendo a autoridade, via `SlugTaken`), e para o campo de
 * assinatura da matéria conseguir casar o que o jornalista digitou com um
 * colunista já cadastrado.
 */
export function slugForSignature(name: string): string | null {
	const slug = Slug.create(name);
	return slug.isOk() ? slug.value.value : null;
}
