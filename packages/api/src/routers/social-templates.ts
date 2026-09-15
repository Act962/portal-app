import type { Result } from "@portal-app/shared-kernel";
import {
	ART_FORMATS,
	type ArtDesign,
	ArtTemplate,
	archiveTemplate,
	createTemplate,
	duplicateTemplate,
	getTemplate,
	LABEL_MAX,
	listTemplates,
	MAX_ELEMENTS,
	MAX_VARIABLES,
	SOCIAL_DESTINATIONS,
	setTemplateDefaults,
	TEMPLATE_NAME_MAX,
	TEMPLATE_TEXT_MAX,
	TEXT_MODES,
	updateTemplate,
} from "@portal-app/social";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router } from "../index";
import { artRenderer, templateDeps } from "../social";

/**
 * Os padrões de arte no painel (specs 09 e 10).
 *
 * Escolher é `social:publish`; desenhar é `social:manage` — a regra mora nos
 * casos de uso, e os procedimentos repetem a exigência só para o 403 sair
 * antes de tocar no banco.
 */
const choose = requirePermission("social:publish");
const design = requirePermission("social:manage");

/**
 * A FORMA do desenho. O zod confere tipos, enumerações e tetos de tamanho; o
 * que é regra (fonte disponível, cor válida, variável que existe, caixa dentro
 * do quadro) fica com o agregado, que devolve os problemas em português.
 */
const text = z.string().max(TEMPLATE_TEXT_MAX);
const color = z.string().max(16);
const stroke = z.object({ color, width: z.number() });
const shadow = z.object({
	color,
	blur: z.number(),
	offsetX: z.number(),
	offsetY: z.number(),
	opacity: z.number(),
});
const fill = z.discriminatedUnion("type", [
	z.object({ type: z.literal("solid"), color }),
	z.object({
		type: z.literal("linear"),
		angle: z.number(),
		stops: z.array(z.object({ offset: z.number(), color })).max(8),
	}),
]);

const base = {
	id: z.string().max(64),
	name: z.string().max(TEMPLATE_NAME_MAX),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	rotation: z.number(),
	opacity: z.number(),
	visible: z.boolean(),
	locked: z.boolean(),
};

const textStyle = z.object({
	fontFamily: z.string(),
	fontWeight: z.number().int(),
	italic: z.boolean(),
	fontSize: z.number(),
	minFontSize: z.number(),
	maxLines: z.number().int(),
	lineHeight: z.number(),
	letterSpacing: z.number(),
	color,
	align: z.enum(["left", "center", "right"]),
	verticalAlign: z.enum(["top", "middle", "bottom"]),
	uppercase: z.boolean(),
	stroke: stroke.nullable(),
	shadow: shadow.nullable(),
	background: z
		.object({
			color,
			radius: z.number(),
			paddingX: z.number(),
			paddingY: z.number(),
			shape: z.enum(["hug", "box"]),
		})
		.nullable(),
});

const element = z.discriminatedUnion("kind", [
	z.object({
		...base,
		kind: z.literal("PHOTO"),
		repeat: z.enum(["none", "vertical", "horizontal"]).optional(),
		repeatCount: z.number().int().min(2).max(6).optional(),
		cornerRadius: z.number(),
		stroke: stroke.nullable(),
	}),
	z.object({
		...base,
		kind: z.literal("IMAGE"),
		mediaId: z.string(),
		fit: z.enum(["cover", "contain", "stretch"]),
		cornerRadius: z.number(),
	}),
	z.object({
		...base,
		kind: z.literal("RECT"),
		fill,
		cornerRadius: z.number(),
		stroke: stroke.nullable(),
		shadow: shadow.nullable(),
	}),
	z.object({
		...base,
		kind: z.literal("ELLIPSE"),
		fill,
		stroke: stroke.nullable(),
		shadow: shadow.nullable(),
	}),
	z.object({ ...base, kind: z.literal("LINE"), stroke }),
	z.object({
		...base,
		kind: z.literal("TEXT"),
		mode: z.enum(TEXT_MODES),
		content: z.string().max(TEMPLATE_TEXT_MAX * 2),
		fieldLabel: z.string().max(LABEL_MAX * 2),
		style: textStyle,
	}),
]);

export const artDesignInput = z.object({
	background: color,
	elements: z.array(element).max(MAX_ELEMENTS),
	variables: z
		.array(
			z.object({
				key: z.string().max(64),
				label: z.string().max(LABEL_MAX * 2),
				defaultValue: z.string().max(TEMPLATE_TEXT_MAX * 2),
				multiline: z.boolean(),
			}),
		)
		.max(MAX_VARIABLES),
});

/** O que preenche as variáveis do sistema (spec 10, D2). */
export const artContentInput = z.object({
	headline: text,
	subtitle: text.nullable(),
	kicker: text.nullable(),
	sectionName: text.nullable(),
	authorName: text.nullable(),
	siteName: text.nullable(),
	date: z.string().max(40).nullable(),
});

/** O que a redação preencheu no post (spec 10, D3). */
export const artInputsInput = z.object({
	values: z.record(z.string(), text),
	texts: z.record(z.string(), text),
});

const format = z.enum(ART_FORMATS);

/** O zod devolve `fontFamily: string`; quem confere a família é o agregado. */
const asDesign = <T extends z.infer<typeof artDesignInput> | undefined>(
	value: T,
) => value as T extends undefined ? ArtDesign | undefined : ArtDesign;

export function templateDto(template: ArtTemplate) {
	return {
		id: template.id,
		name: template.name,
		format: template.format,
		canvas: template.canvas,
		design: template.design,
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

export const socialTemplatesRouter = router({
	/**
	 * A arte FINAL de um desenho, pelo desenhista do servidor — o mesmo que
	 * publica. O editor desenha ao vivo no navegador (spec 10, D9); isto é a
	 * conferência "como vai sair", e aceita o desenho ainda NÃO salvo. Desenho
	 * inválido não desenha; devolve os problemas.
	 *
	 * Mutation, e não query, só pelo tamanho: o desenho não cabe numa URL.
	 */
	preview: choose
		.input(
			z.object({
				name: z.string().optional(),
				format,
				design: artDesignInput,
				content: artContentInput,
				inputs: artInputsInput.optional(),
				photoMediaId: z.string().nullish(),
				width: z.number().int().min(120).max(1080).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const created = ArtTemplate.create({
				id: "previa",
				name: input.name?.trim() || "Prévia",
				format: input.format,
				design: asDesign(input.design),
				createdAt: templateDeps.clock.now(),
			});
			if (created.isErr()) {
				return {
					image: null,
					problems: [...created.error.problems],
					warnings: [] as string[],
				};
			}
			const request = {
				template: created.value,
				photoMediaId: input.photoMediaId ?? null,
				content: input.content,
				inputs: input.inputs,
			};
			const [png, warnings] = await Promise.all([
				artRenderer.preview(request, input.width ?? 540),
				artRenderer.warnings(request),
			]);
			return {
				image: `data:image/png;base64,${png.toString("base64")}`,
				problems: [] as string[],
				warnings,
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
				design: artDesignInput.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(
					await createTemplate(
						ctx.staff,
						{ ...input, design: asDesign(input.design) },
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
				design: artDesignInput.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			templateDto(
				ensure(
					await updateTemplate(
						ctx.staff,
						{ ...input, design: asDesign(input.design) },
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

	/** Marca de que destinos é o padrão — e desmarca quem era (09, D10). */
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
