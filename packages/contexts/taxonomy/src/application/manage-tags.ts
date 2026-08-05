import { type IdGenerator, type Result, err, ok } from "@portal-app/shared-kernel";

import {
	CannotMergeIntoItself,
	type InvalidSlug,
	type NameRequired,
	SlugTaken,
	TagInUse,
	TagNotFound,
} from "../domain/errors";
import type { ContentUsage } from "../domain/ports/content-usage";
import type { TagRepository } from "../domain/ports/tag-repository";
import { Tag } from "../domain/tag";

/** Autorização na fronteira da API, como nas editorias. Aqui só as regras da tag. */
type Deps = {
	repo: TagRepository;
	usage: ContentUsage;
	ids: IdGenerator;
};

export function listTags(deps: Pick<Deps, "repo">): Promise<Tag[]> {
	return deps.repo.list();
}

export async function createTag(
	input: { name: string; slug?: string },
	deps: Pick<Deps, "repo" | "ids">,
): Promise<Result<Tag, NameRequired | InvalidSlug | SlugTaken>> {
	const created = Tag.create({ id: deps.ids.generate(), name: input.name, slug: input.slug });
	if (created.isErr()) {
		return err(created.error);
	}
	const tag = created.value;

	const clash = await deps.repo.findBySlug(tag.slug);
	if (clash) {
		return err(new SlugTaken(tag.slug));
	}

	await deps.repo.save(tag);
	return ok(tag);
}

export async function renameTag(
	input: { id: string; name: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<Tag, TagNotFound | NameRequired>> {
	const tag = await deps.repo.findById(input.id);
	if (!tag) {
		return err(new TagNotFound(input.id));
	}
	const renamed = tag.rename(input.name);
	if (renamed.isErr()) {
		return err(renamed.error);
	}
	await deps.repo.save(tag);
	return ok(tag);
}

export async function deleteTag(
	input: { id: string },
	deps: Pick<Deps, "repo" | "usage">,
): Promise<Result<void, TagNotFound | TagInUse>> {
	const tag = await deps.repo.findById(input.id);
	if (!tag) {
		return err(new TagNotFound(input.id));
	}
	if (await deps.usage.tagHasPublishedContent(tag.id)) {
		return err(new TagInUse());
	}
	await deps.repo.delete(tag.id);
	return ok(undefined);
}

/**
 * Mescla `sourceId` em `targetId` (A19). Nesta fase, "mesclar" = remover a
 * duplicada, mantendo o alvo. A reatribuição das matérias da tag de origem para
 * a de destino depende do Editorial (Fase 3, D3): enquanto ela não existe, uma
 * tag de origem EM USO não pode ser mesclada — seria perder vínculos — e o caso
 * devolve `TagInUse`. Sem uso, a origem é descartada.
 */
export async function mergeTags(
	input: { sourceId: string; targetId: string },
	deps: Pick<Deps, "repo" | "usage">,
): Promise<Result<Tag, TagNotFound | TagInUse | CannotMergeIntoItself>> {
	if (input.sourceId === input.targetId) {
		return err(new CannotMergeIntoItself());
	}
	const source = await deps.repo.findById(input.sourceId);
	if (!source) {
		return err(new TagNotFound(input.sourceId));
	}
	const target = await deps.repo.findById(input.targetId);
	if (!target) {
		return err(new TagNotFound(input.targetId));
	}
	if (await deps.usage.tagHasPublishedContent(source.id)) {
		return err(new TagInUse());
	}
	await deps.repo.delete(source.id);
	return ok(target);
}
