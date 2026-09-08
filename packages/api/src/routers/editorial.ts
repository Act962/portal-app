import {
	type Article,
	approve,
	archive,
	archiveMany,
	BLOCK_ALIGNMENTS,
	cancelSchedule,
	changeSlug,
	createDraft,
	deleteArticle,
	deleteMany,
	EDITORIAL_STATUSES,
	getArticle,
	INLINE_MARKS,
	listArticles,
	listScheduled,
	publish,
	publishDueScheduled,
	reject,
	schedule,
	submitForReview,
	updateArticle,
} from "@portal-app/editorial";
import { getAsset } from "@portal-app/media";
import {
	DEFAULT_PAGE_SIZE,
	type Result,
	toPageRequest,
} from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	articleDeps,
	countArticlesByStatus,
	dispatchEditorialEvents,
	listAuditLog,
} from "../editorial";
import { requirePermission, router, staffProcedure } from "../index";
import { mediaDeps } from "../media";
import { revalidateArticlePaths } from "../portal-cache";

/**
 * Nó inline (ADR 0010): a formatação dentro de um texto.
 *
 * As marcas são um CONJUNTO desde 08/09 — ver `body.ts`. Os dois tipos antigos
 * (`strong`/`em` como TIPO do nó) continuam aceitos porque o corpo de uma
 * matéria gravada antes disso volta ao painel inteiro e é reenviado no
 * salvamento seguinte; recusá-los aqui quebraria o autosave dessas matérias.
 * O domínio converte para o formato novo.
 */
const markSchema = z.enum(INLINE_MARKS);

const inlineSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("text"),
		text: z.string(),
		marks: z.array(markSchema).optional(),
	}),
	z.object({
		type: z.literal("link"),
		text: z.string(),
		href: z.string(),
		marks: z.array(markSchema).optional(),
	}),
	z.object({ type: z.literal("strong"), text: z.string() }),
	z.object({ type: z.literal("em"), text: z.string() }),
]);

/** Alinhamento do bloco. `left` não existe: é o padrão, e a ausência o diz. */
const alignSchema = z.enum(BLOCK_ALIGNMENTS).optional();

/** Conteúdo de um bloco de texto. Aceita também o formato anterior ao ADR 0010
 * (uma string) — defesa em profundidade: o domínio normaliza de todo jeito. */
const contentSchema = z.union([z.array(inlineSchema), z.string()]);

/** Blocos do corpo (D1) — espelha a união discriminada do domínio. */
const blockSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("paragraph"),
		content: contentSchema,
		align: alignSchema,
	}),
	z.object({
		type: z.literal("heading"),
		level: z.union([z.literal(2), z.literal(3)]),
		content: contentSchema,
		align: alignSchema,
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

/**
 * Preenche o alt-text da capa a partir do PRÓPRIO arquivo, ignorando a cópia que
 * o cliente mandou.
 *
 * A `Cover` guarda o alt-text junto (`contextos-isolados`: o editorial precisa
 * verificar "capa com alt-text" sem consultar mídia), e até aqui quem preenchia
 * essa cópia era a tela. Ela não tinha como acertar: o autosave dispara um
 * segundo depois do clique, quando o asset recém-escolhido ainda não chegou ao
 * cliente — então gravava `""` e a matéria ficava com a pendência "a imagem de
 * capa precisa de texto alternativo" para sempre, apesar de a imagem ter alt. A
 * pendência não saía nem depois, porque nada mandava salvar de novo.
 *
 * Quem sabe o alt-text de um arquivo é o arquivo. Resolver aqui, na raiz de
 * composição (o único lugar que enxerga os dois contextos), também sincroniza a
 * cópia quando o alt é corrigido na biblioteca: o salvamento seguinte já traz o
 * texto novo.
 */
async function resolveCover(cover: z.infer<typeof coverSchema>) {
	if (!cover) {
		return cover;
	}
	const asset = await getAsset(cover.mediaId, mediaDeps);
	// Arquivo inexistente cai no que veio do cliente — a capa é validada mais
	// adiante, e inventar um alt aqui esconderia o problema real.
	return asset
		? { mediaId: cover.mediaId, altText: asset.altText?.value ?? "" }
		: cover;
}

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
		// A tela usa isto para saber se apagar destrói um ENDEREÇO que o público
		// conhece — o que decide a força da confirmação. `publishedAt` não serve:
		// ele responde "quando foi ao ar da última vez", e uma matéria despublicada
		// e republicada tem os dois preenchidos.
		firstPublishedAt: article.firstPublishedAt,
		// Carimbos da linha, para as colunas "Criada" e "Atualizada" da lista.
		// Nulos só em matéria recém-criada, antes de a leitura seguinte voltar do
		// banco — a lista sempre lê do banco, então lá eles nunca faltam.
		createdAt: article.createdAt,
		updatedAt: article.updatedAt,
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
		// Não é entrada malformada: o pedido está correto, o ESTADO é que não
		// permite. Uma matéria no ar só vira apagável depois de arquivada.
		case "ArticleOnAir":
			return "CONFLICT";
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

/** O endereço público de uma matéria, do jeito que o cache do portal o conhece. */
type PublicRef = { slug: string; sectionId: string | null };

/**
 * Onde a matéria mora no portal ANTES da mutação, e se ela chegou a estar no ar.
 *
 * Serve a dois usos, e os dois precisam do estado anterior: invalidar o endereço
 * VELHO quando o slug ou a editoria mudam, e saber o que invalidar depois de um
 * apagamento, quando já não há a quem perguntar.
 */
async function snapshot(
	id: string,
): Promise<(PublicRef & { wasPublic: boolean }) | null> {
	const article = await articleDeps.repo.findById(id);
	return article
		? {
				slug: article.slug,
				sectionId: article.sectionId,
				wasPublic: article.firstPublishedAt !== null,
			}
		: null;
}

/**
 * O mesmo retrato, para um lote. Sequencial pela mesma razão do `runBulk` do
 * caso de uso: são leituras indexadas de uma ação de tela, e disparar cem
 * consultas concorrentes trocaria latência por contenção no banco.
 */
async function snapshotMany(ids: readonly string[]) {
	const before = new Map<string, PublicRef & { wasPublic: boolean }>();
	for (const id of ids) {
		const ref = await snapshot(id);
		if (ref) {
			before.set(id, ref);
		}
	}
	return before;
}

/**
 * Derruba o cache das que REALMENTE mudaram — `outcome.done`, não a seleção
 * inteira. Um lote é parcial de propósito, e invalidar a página de uma matéria
 * que a autorização recusou seria custo sem efeito.
 */
async function revalidateBulk(
	before: Map<string, PublicRef & { wasPublic: boolean }>,
	done: readonly string[],
) {
	for (const id of done) {
		const ref = before.get(id);
		if (ref?.wasPublic) {
			await revalidateArticlePaths(ref);
		}
	}
}

/**
 * Desembrulha, despacha o outbox pelo bus síncrono — assim a auditoria e demais
 * consumidores reagem logo após a transação (em produção um node-cron/Inngest
 * poderia dirigir o despacho; aqui é síncrono, §5.1) — e **derruba o cache da
 * página pública** da matéria.
 *
 * A invalidação entra AQUI, no funil por onde passa toda mutação de uma matéria,
 * e não espalhada por dez procedures: é assim que a próxima transição a ganhar
 * de graça, em vez de alguém descobrir meses depois que só o `publish`
 * invalidava. Ver `portal-cache.ts` para a medição que motivou isto.
 *
 * `firstPublishedAt` é o gatilho, e não o status: rascunho nunca teve endereço
 * público, então não há cache a derrubar; e matéria que ACABOU de ser arquivada
 * precisa da invalidação justamente porque a página dela tem de sair do ar.
 */
async function commit(result: Result<Article, Error>, previous?: PublicRef) {
	const dto = ensure(result);
	await dispatchEditorialEvents();
	if (dto.firstPublishedAt !== null) {
		await revalidateArticlePaths(dto, previous);
	}
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
						/** Traz também as arquivadas. Por padrão elas ficam de fora. */
						includeArchived: z.boolean().optional(),
						/** 1-based, como a UI conta. `toPageRequest` normaliza e limita. */
						page: z.number().int().optional(),
						perPage: z.number().int().optional(),
					})
					.optional(),
			)
			.query(async ({ input }) => {
				const { page, perPage, ...filter } = input ?? {};
				const result = await listArticles(
					filter,
					articleDeps,
					toPageRequest({ page, perPage }),
				);
				return {
					items: result.items.map(articleDto),
					total: result.total,
					page: page ?? 1,
					perPage: perPage ?? DEFAULT_PAGE_SIZE,
				};
			}),

		/** Contagem por status — os cartões da visão geral. Separado do `list`
		 * porque aquele agora devolve uma PÁGINA: contar no cliente contaria só
		 * os 20 da tela. */
		counts: staffProcedure.query(() => countArticlesByStatus()),

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
						{
							...input,
							cover: await resolveCover(input.cover),
							authorName: ctx.session.user.name ?? "Redação",
						},
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
			.mutation(async ({ ctx, input }) => {
				// Lido ANTES: mudar a EDITORIA muda o endereço público, e sem o
				// anterior a página velha ficaria no ar em cache — com o texto novo
				// disponível em outro caminho.
				const previous = await snapshot(input.id);
				return commit(
					await updateArticle(
						ctx.staff,
						{ ...input, cover: await resolveCover(input.cover) },
						articleDeps,
					),
					previous ?? undefined,
				);
			}),

		changeSlug: staffProcedure
			.input(z.object({ id: z.string(), slug: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const previous = await snapshot(input.id);
				return commit(
					await changeSlug(ctx.staff, input, articleDeps),
					previous ?? undefined,
				);
			}),

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

		/**
		 * Arquiva a seleção da lista. Devolve o que passou e o que ficou em vez
		 * de estourar no primeiro erro: a tela precisa dizer "7 arquivadas, 1
		 * já estava arquivada", e um `TRPCError` só saberia contar a falha.
		 *
		 * O teto de 100 não é burocracia — é o tamanho acima do qual uma ação de
		 * clique único vira uma migração de acervo, e essa passa por outro lugar.
		 */
		archiveMany: staffProcedure
			.input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
			.mutation(async ({ ctx, input }) => {
				const before = await snapshotMany(input.ids);
				const outcome = await archiveMany(ctx.staff, input, articleDeps);
				await dispatchEditorialEvents();
				await revalidateBulk(before, outcome.done);
				return outcome;
			}),

		/**
		 * Apaga UMA matéria. Devolve o que sumiu (título e endereço), porque
		 * depois disto não há mais o que consultar — e um aviso dizendo apenas
		 * "apagada" não deixa a redação conferir se apagou o que queria.
		 */
		remove: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				// Depois do apagamento não há a quem perguntar onde a matéria morava,
				// e é justamente a página dela que precisa sair do cache — senão o
				// portal segue servindo, por até um minuto, uma matéria que já não
				// existe.
				const before = await snapshot(input.id);
				const result = await deleteArticle(ctx.staff, input, articleDeps);
				if (result.isErr()) {
					const error = result.unwrapErr();
					throw new TRPCError({ code: codeFor(error), message: error.message });
				}
				// O `ArticleDeleted` já está no outbox (mesma transação do apagamento);
				// isto o entrega à auditoria, que é o que sobra da matéria.
				await dispatchEditorialEvents();
				if (before?.wasPublic) {
					await revalidateArticlePaths(before);
				}
				return result.unwrap();
			}),

		removeMany: staffProcedure
			.input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
			.mutation(async ({ ctx, input }) => {
				const before = await snapshotMany(input.ids);
				const outcome = await deleteMany(ctx.staff, input, articleDeps);
				await dispatchEditorialEvents();
				await revalidateBulk(before, outcome.done);
				return outcome;
			}),
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
			// A agendada que venceu é matéria NOVA no ar: se já houver página em
			// cache para aquele endereço (uma despublicada que voltou, por
			// exemplo), ela precisa sair na hora.
			for (const article of published) {
				await revalidateArticlePaths(article);
			}
			return { published: published.length };
		}),
	}),

	/** Auditoria (A35): registro imutável derivado dos eventos. Só quem tem
	 * `audit:view` (ADMIN) lê — a página já redirecionava, mas a procedure
	 * estava aberta a qualquer membro ativo pela rede. */
	audit: router({
		list: requirePermission("audit:view")
			.input(
				z
					.object({
						page: z.number().int().optional(),
						perPage: z.number().int().optional(),
					})
					.optional(),
			)
			.query(async ({ input }) => {
				const result = await listAuditLog(toPageRequest(input));
				return {
					...result,
					page: input?.page ?? 1,
					perPage: input?.perPage ?? DEFAULT_PAGE_SIZE,
				};
			}),
	}),
});
