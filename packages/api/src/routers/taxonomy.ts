import type { Result } from "@portal-app/shared-kernel";
import {
	createSection,
	createTag,
	deleteSection,
	deleteTag,
	listSections,
	listTags,
	mergeTags,
	renameTag,
	reorderSections,
	type Section,
	setSectionActive,
	type Tag,
	updateSection,
} from "@portal-app/taxonomy";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router, staffProcedure } from "../index";
import { sectionDeps, tagDeps } from "../taxonomy";

/**
 * Só as MUTAÇÕES exigem `taxonomy:manage` (que apenas o ADMIN tem).
 *
 * As leituras são `staffProcedure`: qualquer membro ativo precisa listar
 * editorias e tags para classificar a própria matéria — e editoria é pendência
 * de publicação. Quando `list` também exigia `manage`, REDATOR e EDITOR abriam o
 * editor, recebiam FORBIDDEN e ficavam com o select vazio, sem conseguir
 * publicar. Ler a taxonomia não é gerenciá-la.
 */
const manage = requirePermission("taxonomy:manage");

function sectionDto(section: Section) {
	return {
		id: section.id,
		name: section.name,
		slug: section.slug,
		description: section.description,
		color: section.color,
		order: section.order,
		active: section.isActive(),
		parentId: section.parentId,
	};
}

function tagDto(tag: Tag) {
	return { id: tag.id, name: tag.name, slug: tag.slug };
}

/** Traduz o erro de domínio (valor) no código HTTP/TRPC adequado. */
function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "SlugTaken":
			return "CONFLICT";
		case "SectionNotFound":
		case "TagNotFound":
			return "NOT_FOUND";
		default:
			return "BAD_REQUEST";
	}
}

/** Desembrulha um `Result` ou lança o `TRPCError` correspondente. */
function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

export const taxonomyRouter = router({
	sections: router({
		list: staffProcedure.query(async () =>
			(await listSections(sectionDeps)).map(sectionDto),
		),

		create: manage
			.input(
				z.object({
					name: z.string(),
					slug: z.string().optional(),
					description: z.string().optional(),
					color: z.string().nullish(),
					parentId: z.string().nullish(),
				}),
			)
			.mutation(async ({ input }) =>
				sectionDto(ensure(await createSection(input, sectionDeps))),
			),

		update: manage
			.input(
				z.object({
					id: z.string(),
					name: z.string().optional(),
					description: z.string().optional(),
					color: z.string().nullish(),
				}),
			)
			.mutation(async ({ input }) =>
				sectionDto(ensure(await updateSection(input, sectionDeps))),
			),

		setActive: manage
			.input(z.object({ id: z.string(), active: z.boolean() }))
			.mutation(async ({ input }) =>
				sectionDto(ensure(await setSectionActive(input, sectionDeps))),
			),

		reorder: manage
			.input(
				z.object({
					orders: z.array(
						z.object({ id: z.string(), order: z.number().int() }),
					),
				}),
			)
			.mutation(async ({ input }) => {
				ensure(await reorderSections(input, sectionDeps));
				return { ok: true };
			}),

		delete: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				ensure(await deleteSection(input, sectionDeps));
				return { ok: true };
			}),
	}),

	tags: router({
		list: staffProcedure.query(async () =>
			(await listTags(tagDeps)).map(tagDto),
		),

		create: manage
			.input(z.object({ name: z.string(), slug: z.string().optional() }))
			.mutation(async ({ input }) =>
				tagDto(ensure(await createTag(input, tagDeps))),
			),

		rename: manage
			.input(z.object({ id: z.string(), name: z.string() }))
			.mutation(async ({ input }) =>
				tagDto(ensure(await renameTag(input, tagDeps))),
			),

		merge: manage
			.input(z.object({ sourceId: z.string(), targetId: z.string() }))
			.mutation(async ({ input }) =>
				tagDto(ensure(await mergeTags(input, tagDeps))),
			),

		delete: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				ensure(await deleteTag(input, tagDeps));
				return { ok: true };
			}),
	}),
});
