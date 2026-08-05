import {
	type Article,
	approve,
	archive,
	cancelSchedule,
	changeSlug,
	createDraft,
	EDITORIAL_STATUSES,
	getArticle,
	listArticles,
	listScheduled,
	publish,
	publishDueScheduled,
	reject,
	schedule,
	submitForReview,
	updateArticle,
} from "@portal-app/editorial";
import type { Result } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	articleDeps,
	dispatchEditorialEvents,
	listAuditLog,
} from "../editorial";
import { requirePermission, router, staffProcedure } from "../index";

/** Nó inline (ADR 0010): a formatação dentro de um texto. */
const inlineSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), text: z.string() }),
	z.object({ type: z.literal("strong"), text: z.string() }),
	z.object({ type: z.literal("em"), text: z.string() }),
	z.object({ type: z.literal("link"), text: z.string(), href: z.string() }),
]);

/** Conteúdo de um bloco de texto. Aceita também o formato anterior ao ADR 0010
 * (uma string) — defesa em profundidade: o domínio normaliza de todo jeito. */
const contentSchema = z.union([z.array(inlineSchema), z.string()]);

/** Blocos do corpo (D1) — espelha a união discriminada do domínio. */
const blockSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("paragraph"), content: contentSchema }),
	z.object({
		type: z.literal("heading"),
		level: z.union([z.literal(2), z.literal(3)]),
		content: contentSchema,
	}),
	z.object({
		type: z.literal("image"),
		mediaId: z.string(),
		caption: z.string().optional(),
	}),
	z.object({
		type: z.literal("list"),
		ordered: z.boolean(),
		items: z.array(z.union([z.array(inlineSchema), z.string()])),
	}),
	z.object({
		type: z.literal("quote"),
		content: contentSchema,
		cite: z.string().optional(),
	}),
	z.object({ type: z.literal("embed"), url: z.string() }),
]);

const coverSchema = z
	.object({ mediaId: z.string(), altText: z.string().nullish() })
	.nullish();

function articleDto(article: Article) {
	return {
		id: article.id,
		headline: article.headline,
		slug: article.slug,
		kicker: article.kicker,
		standfirst: article.standfirst,
		status: article.status,
		sectionId: article.sectionId,
		tagIds: [...article.tagIds],
		cover: article.cover
			? { mediaId: article.cover.mediaId, altText: article.cover.altText }
			: null,
		body: article.body.blocks,
		byline: { authorId: article.byline.authorId, name: article.byline.name },
		scheduledAt: article.scheduledAt,
		publishedAt: article.publishedAt,
		rejectionReason: article.rejectionReason,
		// A04: pendências que impedem publicar, para a UI listar antes do clique.
		pendencias: article.publishPreflight().map((blocker) => blocker.message),
	};
}

function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "Forbidden":
			return "FORBIDDEN";
		case "ArticleNotFound":
			return "NOT_FOUND";
		default:
			return "BAD_REQUEST";
	}
}

function ensure(result: Result<Article, Error>) {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return articleDto(result.unwrap());
}

/**
 * Desembrulha E despacha o outbox pelo bus síncrono — assim a auditoria e demais
 * consumidores reagem logo após a transação. Em produção um node-cron/Inngest
 * poderia dirigir o despacho; aqui é síncrono (§5.1).
 */
async function commit(result: Result<Article, Error>) {
	const dto = ensure(result);
	await dispatchEditorialEvents();
	return dto;
}

const contentInput = {
	headline: z.string().optional(),
	kicker: z.string().nullish(),
	standfirst: z.string().nullish(),
	sectionId: z.string().nullish(),
	tagIds: z.array(z.string()).optional(),
	body: z.array(blockSchema).optional(),
	cover: coverSchema,
};

export const editorialRouter = router({
	articles: router({
		list: staffProcedure
			.input(
				z
					.object({
						status: z.enum(EDITORIAL_STATUSES).optional(),
						sectionId: z.string().optional(),
						authorId: z.string().optional(),
						search: z.string().optional(),
					})
					.optional(),
			)
			.query(async ({ input }) =>
				(await listArticles(input ?? {}, articleDeps)).map(articleDto),
			),

		get: staffProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ input }) => {
				const article = await getArticle(input.id, articleDeps);
				return article ? articleDto(article) : null;
			}),

		create: staffProcedure
			.input(z.object({ ...contentInput, headline: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(
					await createDraft(
						ctx.staff,
						{ ...input, authorName: ctx.session.user.name ?? "Redação" },
						articleDeps,
					),
				),
			),

		update: staffProcedure
			.input(
				z.object({
					id: z.string(),
					...contentInput,
					authorName: z.string().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) =>
				commit(await updateArticle(ctx.staff, input, articleDeps)),
			),

		changeSlug: staffProcedure
			.input(z.object({ id: z.string(), slug: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await changeSlug(ctx.staff, input, articleDeps)),
			),

		submit: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await submitForReview(ctx.staff, input, articleDeps)),
			),

		approve: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await approve(ctx.staff, input, articleDeps)),
			),

		reject: staffProcedure
			.input(z.object({ id: z.string(), reason: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await reject(ctx.staff, input, articleDeps)),
			),

		publish: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await publish(ctx.staff, input, articleDeps)),
			),

		schedule: staffProcedure
			.input(z.object({ id: z.string(), at: z.coerce.date() }))
			.mutation(async ({ ctx, input }) =>
				commit(await schedule(ctx.staff, input, articleDeps)),
			),

		cancelSchedule: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await cancelSchedule(ctx.staff, input, articleDeps)),
			),

		archive: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				commit(await archive(ctx.staff, input, articleDeps)),
			),
	}),

	schedules: router({
		/** Calendário editorial (A15): tudo que está agendado. */
		list: staffProcedure.query(async () =>
			(await listScheduled(articleDeps)).map(articleDto),
		),

		/**
		 * Dispara o poller que publica as agendadas vencidas (A13). Em produção,
		 * quem chama isto é um node-cron / trigger (§5.1); no demo, um clique.
		 */
		runDue: staffProcedure.mutation(async () => {
			const published = await publishDueScheduled(articleDeps);
			await dispatchEditorialEvents();
			return { published: published.length };
		}),
	}),

	/** Auditoria (A35): registro imutável derivado dos eventos. Só quem tem
	 * `audit:view` (ADMIN) lê — a página já redirecionava, mas a procedure
	 * estava aberta a qualquer membro ativo pela rede. */
	audit: router({
		list: requirePermission("audit:view").query(() => listAuditLog()),
	}),
});
