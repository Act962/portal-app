import {
	type Columnist,
	createColumnist,
	deleteColumnist,
	listColumnists,
	reorderColumnists,
	setColumnistActive,
	updateColumnist,
} from "@portal-app/columnists";
import type { Result } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { columnistDeps } from "../columnists";
import { publicProcedure, requirePermission, router } from "../index";

/**
 * A leitura é pública: o bloco de colunistas aparece no portal para qualquer
 * leitor, sem sessão. Só as mutações exigem `columnists:manage` (Admin) —
 * mesmo desenho de `broadcast.ts`.
 */
const manage = requirePermission("columnists:manage");

/**
 * As quatro redes conhecidas. Chave fora desta lista é DESCARTADA aqui, antes
 * do domínio: o `list` é público, e um Json aberto viraria um campo livre que o
 * portal renderiza como link — ou seja, injeção de URL arbitrária por quem tem
 * acesso ao painel.
 */
const socialsSchema = z
	.object({
		twitter: z.string().optional(),
		instagram: z.string().optional(),
		linkedin: z.string().optional(),
		website: z.string().optional(),
	})
	.strict();

function columnistDto(columnist: Columnist) {
	return {
		id: columnist.id,
		slug: columnist.slug,
		name: columnist.name,
		beat: columnist.beat,
		blurb: columnist.blurb,
		photoMediaId: columnist.photoMediaId,
		socials: columnist.socials,
		email: columnist.email,
		order: columnist.order,
		active: columnist.isActive,
	};
}

function codeFor(error: Error): TRPCError["code"] {
	if (error.name === "ColumnistNotFound") {
		return "NOT_FOUND";
	}
	// Assinatura repetida é conflito, não entrada malformada: a tela distingue
	// "corrija o campo" de "essa pessoa já está cadastrada".
	return error.name === "SlugTaken" ? "CONFLICT" : "BAD_REQUEST";
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

export const columnistsRouter = router({
	list: publicProcedure.query(async () =>
		(await listColumnists(columnistDeps)).map(columnistDto),
	),

	create: manage
		.input(
			z.object({
				name: z.string(),
				// Só quando a assinatura difere do nome de exibição; em branco, o
				// domínio deriva do nome.
				slug: z.string().optional(),
				beat: z.string().optional(),
				blurb: z.string().optional(),
				photoMediaId: z.string().nullish(),
				socials: socialsSchema.optional(),
				email: z.string().nullish(),
			}),
		)
		.mutation(async ({ input }) =>
			columnistDto(ensure(await createColumnist(input, columnistDeps))),
		),

	update: manage
		.input(
			z.object({
				id: z.string(),
				name: z.string().optional(),
				beat: z.string().optional(),
				blurb: z.string().optional(),
				photoMediaId: z.string().nullish(),
				socials: socialsSchema.optional(),
				email: z.string().nullish(),
			}),
		)
		.mutation(async ({ input }) =>
			columnistDto(ensure(await updateColumnist(input, columnistDeps))),
		),

	setActive: manage
		.input(z.object({ id: z.string(), active: z.boolean() }))
		.mutation(async ({ input }) =>
			columnistDto(ensure(await setColumnistActive(input, columnistDeps))),
		),

	reorder: manage
		.input(
			z.object({
				orders: z.array(z.object({ id: z.string(), order: z.number().int() })),
			}),
		)
		.mutation(async ({ input }) => {
			ensure(await reorderColumnists(input, columnistDeps));
			return { ok: true };
		}),

	delete: manage
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			ensure(await deleteColumnist(input, columnistDeps));
			return { ok: true };
		}),
});
