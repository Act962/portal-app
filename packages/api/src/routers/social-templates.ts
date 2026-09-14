import type { Result } from "@portal-app/shared-kernel";
import {
	ART_FORMATS,
	ArtTemplate,
	archiveTemplate,
	createTemplate,
	duplicateTemplate,
	getTemplate,
	listTemplates,
	MAX_LAYERS,
	overflowWarnings,
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
import { artRenderer, templateDeps } from "../social";

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
	/**
	 * A prévia REAL de um padrão — desenhada pelo mesmo código que gera a arte
	 * publicada (spec 09, D5). Aceita o padrão ainda NÃO salvo: é o que o editor
	 * manda a cada mudança. Padrão inválido não desenha; devolve os problemas.
	 *
	 * Mutation, e não query, só pelo tamanho: as camadas não cabem numa URL.
	 */
	preview: choose
		.input(
			z.object({
				name: z.string().optional(),
				format,
				layers: templateLayers,
				content: z.object({
					headline: z.string().max(TEMPLATE_TEXT_MAX),
					kicker: z.string().max(TEMPLATE_TEXT_MAX).nullable(),
					sectionName: z.string().max(TEMPLATE_TEXT_MAX).nullable(),
				}),
				photoMediaId: z.string().nullish(),
				overrides: z
					.record(z.string(), z.string().max(TEMPLATE_TEXT_MAX))
					.optional(),
				width: z.number().int().min(120).max(1080).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const created = ArtTemplate.create({
				id: "previa",
				name: input.name?.trim() || "Prévia",
				format: input.format,
				layers: asLayers(input.layers),
				createdAt: templateDeps.clock.now(),
			});
			if (created.isErr()) {
				return {
					image: null,
					problems: [...created.error.problems],
					warnings: [],
				};
			}
			const template = created.value;
			const png = await artRenderer.preview(
				{
					template,
					photoMediaId: input.photoMediaId ?? null,
					content: input.content,
					overrides: input.overrides,
				},
				input.width ?? 540,
			);
			return {
				image: `data:image/png;base64,${png.toString("base64")}`,
				problems: [] as string[],
				warnings: overflowWarnings(template, input.content, input.overrides),
			};
		}),

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
