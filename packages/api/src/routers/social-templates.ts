import type { Result } from "@portal-app/shared-kernel";
import {
	ART_FORMATS,
	type ArtTemplate,
	archiveTemplate,
	createTemplate,
	duplicateTemplate,
	getTemplate,
	listTemplates,
	MAX_LAYERS,
	SOCIAL_DESTINATIONS,
	setTemplateDefaults,
	TEMPLATE_TEXT_MAX,
	TEXT_SOURCES,
	type TemplateLayer,
	updateTemplate,
} from "@portal-app/social";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router } from "../index";
import { templateDeps } from "../social";

/**
 * Os padrões de arte no painel (spec 09, F2).
 *
 * Escolher é `social:publish`; desenhar é `social:manage` — a regra mora nos
 * casos de uso, e os procedimentos repetem a exigência só para o 403 sair
 * antes de tocar no banco.
 */
const choose = requirePermission("social:publish");
const design = requirePermission("social:manage");

const box = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
});

/**
 * A FORMA das camadas. O zod confere tipos e o que é enumeração; o que é regra
 * (fonte disponível, cor válida, caixa dentro do quadro, uma foto só) fica com
 * o agregado, que devolve a lista de problemas em português. Validar as regras
 * aqui também seria manter duas listas que divergem.
 */
const textStyle = z.object({
	fontFamily: z.string(),
	fontWeight: z.number().int(),
	italic: z.boolean(),
	fontSize: z.number(),
	minFontSize: z.number(),
	lineHeight: z.number(),
	color: z.string(),
	uppercase: z.boolean(),
	align: z.enum(["left", "center", "right"]),
	verticalAlign: z.enum(["top", "middle", "bottom"]),
	maxLines: z.number().int(),
	background: z
		.object({
			color: z.string(),
			radius: z.number(),
			paddingX: z.number(),
			paddingY: z.number(),
		})
		.nullable(),
});

const layer = z.discriminatedUnion("kind", [
	z.object({ id: z.string(), kind: z.literal("PHOTO"), box }),
	z.object({
		id: z.string(),
		kind: z.literal("IMAGE"),
		box,
		mediaId: z.string(),
		fit: z.enum(["cover", "contain"]),
	}),
	z.object({
		id: z.string(),
		kind: z.literal("SHAPE"),
		box,
		color: z.string(),
		radius: z.number(),
		opacity: z.number(),
	}),
	z.object({
		id: z.string(),
		kind: z.literal("TEXT"),
		box,
		source: z.enum(TEXT_SOURCES),
		text: z.string().max(TEMPLATE_TEXT_MAX),
		style: textStyle,
	}),
]);

export const templateLayers = z.array(layer).max(MAX_LAYERS);
const format = z.enum(ART_FORMATS);

export function templateDto(template: ArtTemplate) {
	return {
		id: template.id,
		name: template.name,
		format: template.format,
		canvas: template.canvas,
		layers: [...template.layers],
		defaultFor: [...template.defaultFor],
		version: template.version,
		archived: template.archived,
		createdAt: template.createdAt,
		updatedAt: template.updatedAt,
	};
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({
			code:
				error.name === "Forbidden"
					? "FORBIDDEN"
					: error.name === "ArtTemplateNotFound"
						? "NOT_FOUND"
						: "BAD_REQUEST",
			message: error.message,
		});
	}
	return result.unwrap();
}

/** O zod devolve `fontFamily: string`; quem confere a família é o agregado. */
const asLayers = (layers: z.infer<typeof templateLayers> | undefined) =>
	layers as readonly TemplateLayer[] | undefined;

export const socialTemplatesRouter = router({
	list: choose
		.input(
			z
				.object({
					includeArchived: z.boolean().optional(),
					format: format.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) =>
			ensure(await listTemplates(ctx.staff, input ?? {}, templateDeps)).map(
				templateDto,
			),
		),

	get: choose
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) =>
			templateDto(ensure(await getTemplate(ctx.staff, input, templateDeps))),
		),

	create: design
		.input(
			z.object({
				name: z.string(),
				format,
				layers: templateLayers.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(
					await createTemplate(
						ctx.staff,
						{ ...input, layers: asLayers(input.layers) },
						templateDeps,
					),
				),
			),
		),

	update: design
		.input(
			z.object({
				id: z.string(),
				name: z.string().optional(),
				format: format.optional(),
				layers: templateLayers.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(
					await updateTemplate(
						ctx.staff,
						{ ...input, layers: asLayers(input.layers) },
						templateDeps,
					),
				),
			),
		),

	duplicate: design
		.input(z.object({ id: z.string(), name: z.string().optional() }))
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(await duplicateTemplate(ctx.staff, input, templateDeps)),
			),
		),

	/** Marca de que destinos é o padrão — e desmarca quem era (D10). */
	setDefaults: design
		.input(
			z.object({
				id: z.string(),
				destinations: z.array(z.enum(SOCIAL_DESTINATIONS)),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(await setTemplateDefaults(ctx.staff, input, templateDeps)),
			),
		),

	archive: design
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(await archiveTemplate(ctx.staff, input, templateDeps)),
			),
		),
});
