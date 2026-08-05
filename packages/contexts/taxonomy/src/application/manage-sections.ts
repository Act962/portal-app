import { type IdGenerator, type Result, err, ok } from "@portal-app/shared-kernel";

import {
	type InvalidColor,
	type InvalidSlug,
	type MaxDepthExceeded,
	type NameRequired,
	SectionInUse,
	SectionNotFound,
	SlugTaken,
} from "../domain/errors";
import type { ContentUsage } from "../domain/ports/content-usage";
import type { SectionRepository } from "../domain/ports/section-repository";
import { Section } from "../domain/section";

/**
 * Casos de uso de editorias. A AUTORIZAÇÃO fica na fronteira da API
 * (`requirePermission("taxonomy:manage")`), não aqui — assim o contexto de
 * taxonomia não importa `identity` e `contextos-isolados` segue satisfeito.
 * Estes casos cuidam só das regras da taxonomia: unicidade de slug, hierarquia,
 * "em uso não exclui".
 */
type Deps = {
	repo: SectionRepository;
	usage: ContentUsage;
	ids: IdGenerator;
};

type CreateInput = {
	name: string;
	slug?: string;
	description?: string;
	color?: string | null;
	parentId?: string | null;
};

type CreateError = NameRequired | InvalidSlug | InvalidColor | MaxDepthExceeded | SlugTaken | SectionNotFound;

export function listSections(deps: Pick<Deps, "repo">): Promise<Section[]> {
	return deps.repo.list();
}

export async function createSection(
	input: CreateInput,
	deps: Deps,
): Promise<Result<Section, CreateError>> {
	// Uma subeditoria exige a mãe carregada — é o agregado que impõe o teto de
	// dois níveis (recusa se a "mãe" já for filha).
	let parent: Section | null = null;
	if (input.parentId) {
		parent = await deps.repo.findById(input.parentId);
		if (!parent) {
			return err(new SectionNotFound(input.parentId));
		}
	}

	// Nova editoria entra no fim da ordenação atual.
	const order = (await deps.repo.list()).length;
	const created = Section.create({
		id: deps.ids.generate(),
		name: input.name,
		slug: input.slug,
		description: input.description,
		color: input.color,
		order,
		parent,
	});
	if (created.isErr()) {
		return err(created.error);
	}
	const section = created.value;

	const clash = await deps.repo.findBySlug(section.slug);
	if (clash) {
		return err(new SlugTaken(section.slug));
	}

	await deps.repo.save(section);
	return ok(section);
}

export async function updateSection(
	input: { id: string; name?: string; description?: string; color?: string | null },
	deps: Pick<Deps, "repo">,
): Promise<Result<Section, SectionNotFound | NameRequired | InvalidColor>> {
	const section = await deps.repo.findById(input.id);
	if (!section) {
		return err(new SectionNotFound(input.id));
	}
	const updated = section.updateDetails(input);
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.repo.save(section);
	return ok(section);
}

export async function setSectionActive(
	input: { id: string; active: boolean },
	deps: Pick<Deps, "repo">,
): Promise<Result<Section, SectionNotFound>> {
	const section = await deps.repo.findById(input.id);
	if (!section) {
		return err(new SectionNotFound(input.id));
	}
	if (input.active) {
		section.activate();
	} else {
		section.deactivate();
	}
	await deps.repo.save(section);
	return ok(section);
}

export async function reorderSections(
	input: { orders: ReadonlyArray<{ id: string; order: number }> },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, SectionNotFound>> {
	for (const { id, order } of input.orders) {
		const section = await deps.repo.findById(id);
		if (!section) {
			return err(new SectionNotFound(id));
		}
		section.reorderTo(order);
		await deps.repo.save(section);
	}
	return ok(undefined);
}

/**
 * Exclusão dura, atrás da porta de uso: editoria que ainda classifica conteúdo
 * publicado não pode ser excluída (A17) — o caminho é desativar.
 */
export async function deleteSection(
	input: { id: string },
	deps: Pick<Deps, "repo" | "usage">,
): Promise<Result<void, SectionNotFound | SectionInUse>> {
	const section = await deps.repo.findById(input.id);
	if (!section) {
		return err(new SectionNotFound(input.id));
	}
	const inUse = await deps.usage.sectionHasPublishedContent(section.id);
	const deletable = section.ensureDeletable(inUse);
	if (deletable.isErr()) {
		return err(deletable.error);
	}
	await deps.repo.delete(section.id);
	return ok(undefined);
}
