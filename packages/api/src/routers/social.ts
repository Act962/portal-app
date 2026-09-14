import { type Result, toPageRequest } from "@portal-app/shared-kernel";
import {
	approvePost,
	cancelPost,
	connectMetaPage,
	countPendingPosts,
	createDraft,
	disconnectAccount,
	getPost,
	listAccounts,
	listQueue,
	retryPost,
	SOCIAL_PLATFORMS,
	type SocialAccount,
	type SocialPost,
	updatePost,
} from "@portal-app/social";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router } from "../index";
import {
	META_PENDING_COOKIE,
	metaOAuth,
	readCookie,
	socialDeps,
	unsealPendingToken,
} from "../social";

/**
 * A fila de publicação no painel.
 *
 * Duas permissões, porque são dois riscos (spec 08, D11): aprovar post é ato
 * EDITORIAL (o editor tem), conectar conta é ato de CREDENCIAL (só o admin).
 */
const publish = requirePermission("social:publish");
const manage = requirePermission("social:manage");

const platform = z.enum(SOCIAL_PLATFORMS);

const postStatus = z.enum([
	"RASCUNHO",
	"PUBLICANDO",
	"PUBLICADO",
	"PARCIAL",
	"FALHOU",
	"CANCELADA",
]);

function postDto(post: SocialPost) {
	return {
		id: post.id,
		articleId: post.articleId,
		origin: post.origin,
		caption: post.caption.value,
		/** Para a tela mostrar o contador sem recontar emoji no cliente. */
		captionLength: post.caption.length,
		hashtagCount: post.caption.hashtags.length,
		mediaIds: [...post.mediaIds],
		linkUrl: post.linkUrl,
		isCarousel: post.isCarousel,
		status: post.status,
		/** O que impede este post de subir — a tela mostra ANTES do clique. */
		blockers: [...post.publicationBlockers()],
		/** A legenda como sai em cada rede (no Facebook, com o link). */
		previews: post.targets.map((target) => ({
			platform: target,
			caption: post.captionFor(target),
		})),
		deliveries: post.deliveries.map((delivery) => ({
			platform: delivery.platform,
			status: delivery.status,
			remoteId: delivery.remoteId,
			permalink: delivery.permalink,
			error: delivery.error,
			attempts: delivery.attempts,
			lastAttemptAt: delivery.lastAttemptAt,
		})),
		createdAt: post.createdAt,
		approvedAt: post.approvedAt,
		approvedByStaffId: post.approvedByStaffId,
	};
}

/**
 * DTO da conta. **Não tem token** — e não tem porque o agregado também não tem
 * (D9). A ausência é estrutural, não uma escolha que este arquivo precise
 * lembrar de fazer a cada campo novo.
 */
function accountDto(account: SocialAccount, now: Date) {
	return {
		id: account.id,
		platform: account.platform,
		remoteId: account.remoteId,
		displayName: account.displayName,
		avatarUrl: account.avatarUrl,
		state: account.stateAt(now),
		tokenExpiresAt: account.tokenExpiresAt,
		unusableReason: account.unusableReasonAt(now),
		connectedAt: account.connectedAt,
	};
}

function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "Forbidden":
			return "FORBIDDEN";
		case "SocialPostNotFound":
		case "SocialAccountNotFound":
			return "NOT_FOUND";
		// Estado errado é CONFLITO, não "requisição inválida": quase sempre é a
		// segunda aba com o botão ainda na tela, e o 409 é o que diz isso.
		case "InvalidPostTransition":
			return "CONFLICT";
		default:
			return "BAD_REQUEST";
	}
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

const draftInput = {
	captionText: z.string().min(1),
	mediaIds: z.array(z.string()).max(10),
	platforms: z.array(platform),
	linkUrl: z.url().nullish(),
};

export const socialRouter = router({
	queue: publish
		.input(
			z.object({
				status: postStatus.optional(),
				platform: platform.optional(),
				articleId: z.string().optional(),
				page: z.number().int().positive().optional(),
				perPage: z.number().int().positive().optional(),
			}),
		)
		.query(async ({ input }) => {
			const page = await listQueue(
				{
					status: input.status,
					platform: input.platform,
					articleId: input.articleId,
				},
				toPageRequest({ page: input.page, perPage: input.perPage }),
				socialDeps,
			);
			return { items: page.items.map(postDto), total: page.total };
		}),

	/** O número do badge na navegação. */
	pendingCount: publish.query(() => countPendingPosts(socialDeps)),

	get: publish.input(z.object({ id: z.string() })).query(async ({ input }) => {
		const post = await getPost(input.id, socialDeps);
		if (!post) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Publicação não encontrada.",
			});
		}
		return postDto(post);
	}),

	createDraft: publish
		.input(z.object({ ...draftInput, articleId: z.string().nullish() }))
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await createDraft(ctx.staff, input, socialDeps))),
		),

	update: publish
		.input(
			z.object({
				id: z.string(),
				captionText: draftInput.captionText.optional(),
				mediaIds: draftInput.mediaIds.optional(),
				platforms: draftInput.platforms.optional(),
				linkUrl: draftInput.linkUrl,
			}),
		)
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await updatePost(ctx.staff, input, socialDeps))),
		),

	/**
	 * Aprova e enfileira. **Não espera a Meta**: devolve assim que o post está
	 * trancado, e a entrega roda na tarefa `publish-social`. A tela mostra
	 * "enviando" e atualiza quando o worker terminar.
	 */
	approve: publish
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await approvePost(ctx.staff, input, socialDeps))),
		),

	retry: publish
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await retryPost(ctx.staff, input, socialDeps))),
		),

	cancel: publish
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await cancelPost(ctx.staff, input, socialDeps))),
		),

	/** Leitura das contas: quem aprova post precisa saber se a conta está no ar
	 * para entender uma falha — por isso `social:publish`, e não `manage`. */
	accounts: publish.query(async ({ ctx }) => {
		const accounts = ensure(await listAccounts(ctx.staff, socialDeps));
		const now = socialDeps.clock.now();
		return accounts.map((account) => accountDto(account, now));
	}),

	/** O App da Meta está configurado neste ambiente? A tela só oferece o login
	 * quando está — sem ele, o botão levaria a um erro. */
	metaStatus: publish.query(() => ({ configured: metaOAuth !== null })),

	/**
	 * As Páginas que a pessoa administra, depois do login da Meta.
	 *
	 * Lê o token de usuário do cookie cifrado que a volta do login deixou. **Não
	 * devolve token nenhum** — só o que a tela precisa para a escolha.
	 */
	metaPages: manage.query(async ({ ctx }) => {
		const pages = await pendingPages(ctx.headers);
		return pages.map((page) => ({
			id: page.id,
			name: page.name,
			pictureUrl: page.pictureUrl,
			instagram: page.instagram
				? {
						username: page.instagram.username,
						pictureUrl: page.instagram.pictureUrl,
					}
				: null,
		}));
	}),

	/** Conecta a Página escolhida e o Instagram vinculado a ela. */
	connectMetaPage: manage
		.input(z.object({ pageId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const pages = await pendingPages(ctx.headers);
			const page = pages.find((item) => item.id === input.pageId);
			if (!page) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Esta Página não está entre as que você administra.",
				});
			}
			const accounts = ensure(
				await connectMetaPage(
					ctx.staff,
					{
						pageId: page.id,
						pageName: page.name,
						pageAccessToken: page.accessToken,
						pagePictureUrl: page.pictureUrl,
						instagram: page.instagram,
					},
					socialDeps,
				),
			);
			const now = socialDeps.clock.now();
			return {
				accounts: accounts.map((account) => accountDto(account, now)),
				// A tela avisa quando a Página não tem Instagram vinculado: sem este
				// sinal, a pessoa acharia que o Instagram também foi conectado.
				instagramLinked: page.instagram !== null,
			};
		}),

	disconnect: manage
		.input(z.object({ platform }))
		.mutation(async ({ ctx, input }) => {
			const account = ensure(
				await disconnectAccount(ctx.staff, input, socialDeps),
			);
			return accountDto(account, socialDeps.clock.now());
		}),
});

/**
 * As Páginas do login pendente. Falha com mensagem clara quando o login venceu
 * (dez minutos) ou nunca aconteceu, em vez de uma lista vazia que pareceria
 * "você não administra Página nenhuma".
 */
async function pendingPages(headers: Headers) {
	if (!metaOAuth) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "A integração com a Meta não está configurada neste ambiente.",
		});
	}
	const token = unsealPendingToken(
		readCookie(headers, META_PENDING_COOKIE),
		socialDeps.clock.now(),
	);
	if (!token) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"O login da Meta expirou. Clique em Conectar com a Meta de novo.",
		});
	}
	const pages = await metaOAuth.listPages(token);
	if (pages.isErr()) {
		throw new TRPCError({
			code: "BAD_GATEWAY",
			message: `A Meta não devolveu as Páginas: ${pages.unwrapErr().message}`,
		});
	}
	return pages.unwrap();
}
