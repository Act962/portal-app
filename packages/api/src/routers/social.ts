import { type Result, toPageRequest } from "@portal-app/shared-kernel";
import {
	approvePost,
	cancelPost,
	choosePostArt,
	connectMetaPage,
	countPendingPosts,
	createDraft,
	DESTINATION_PLATFORM,
	defaultTemplateFor,
	diagnoseAccounts,
	disconnectAccount,
	getPost,
	listAccounts,
	listQueue,
	overflowWarnings,
	prepareArticlePost,
	retryPost,
	SOCIAL_DESTINATIONS,
	SOCIAL_PLATFORMS,
	type SocialAccount,
	type SocialPost,
	selectionAsTemplate,
	setPostArtContent,
	setPostArtOverrides,
	TEMPLATE_TEXT_MAX,
	updatePost,
} from "@portal-app/social";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router } from "../index";
import { wakeTask } from "../inngest";
import {
	diagnoseDeps,
	isAccountFromEnvironment,
	META_PENDING_COOKIE,
	metaOAuth,
	readCookie,
	socialDeps,
	templateDeps,
	unsealPendingToken,
} from "../social";
import { loadArticleForSocial } from "../social-trigger";
import { socialTemplatesRouter } from "./social-templates";

/**
 * A fila de publicação no painel.
 *
 * Duas permissões, porque são dois riscos (spec 08, D11): aprovar post é ato
 * EDITORIAL (o editor tem), conectar conta é ato de CREDENCIAL (só o admin).
 */
const publish = requirePermission("social:publish");
const manage = requirePermission("social:manage");

const platform = z.enum(SOCIAL_PLATFORMS);
/** O texto trocado no post, por id da camada de texto do padrão. */
const artOverrides = z.record(z.string(), z.string().max(TEMPLATE_TEXT_MAX));
/** Para onde o post vai — o feed de cada rede ou os Stories (spec 08, §17). */
const destination = z.enum(SOCIAL_DESTINATIONS);

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
		/** A legenda e as imagens como saem em cada destino (no Facebook, com o
		 * link; nos Stories, sem legenda e só com a primeira imagem). */
		previews: post.targets.map((target) => ({
			destination: target,
			caption: post.captionFor(target),
			mediaIds: [...post.imagesFor(target)],
		})),
		deliveries: post.deliveries.map((delivery) => ({
			destination: delivery.destination,
			/** A rede da conta que publica este destino. */
			platform: DESTINATION_PLATFORM[delivery.destination],
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
		/** A arte de cada destino que tem padrão — a cópia guardada no post. */
		art: { ...post.artSelections },
		/** O conteúdo guardado das caixas, ou `null` (post avulso). */
		artContent: post.artContent,
		/** O conteúdo com que a arte é de fato desenhada — a tela usa na prévia. */
		artContentForDrawing: post.artContentForDrawing(),
		/** Por destino, os textos que não cabem e vão sair cortados. */
		artWarnings: Object.fromEntries(
			Object.entries(post.artSelections).map(([destination, selection]) => [
				destination,
				selection
					? overflowWarnings(
							selectionAsTemplate(selection),
							post.artContentForDrawing(),
							selection.overrides,
						)
					: [],
			]),
		) as Record<string, string[]>,
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
		/** Veio do `.env` (§15): a tela não oferece desconectar nem mostra data
		 * de conexão, que não existe. */
		managedByEnvironment: isAccountFromEnvironment(account.platform),
	};
}

function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "Forbidden":
			return "FORBIDDEN";
		case "SocialPostNotFound":
		case "SocialAccountNotFound":
		case "ArtTemplateNotFound":
			return "NOT_FOUND";
		// Estado errado é CONFLITO, não "requisição inválida": quase sempre é a
		// segunda aba com o botão ainda na tela, e o 409 é o que diz isso.
		case "InvalidPostTransition":
			return "CONFLICT";
		// Aprovar a publicação de matéria que não está no ar: falta uma condição
		// que não depende da requisição — publicar a matéria.
		case "ArticleNotPublished":
			return "PRECONDITION_FAILED";
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
	platforms: z.array(destination),
	linkUrl: z.url().nullish(),
};

export const socialRouter = router({
	/** Os padrões de arte (spec 09). */
	templates: socialTemplatesRouter,

	queue: publish
		.input(
			z.object({
				status: postStatus.optional(),
				platform: destination.optional(),
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
	 *
	 * Acorda a tarefa na hora (D33), em vez de esperar a próxima rodada do
	 * cron. O aviso sai DEPOIS de gravar, e `wakeTask` nunca lança: se ele
	 * falhar, o post já está na fila e sai na rodada seguinte.
	 */
	approve: publish
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const post = ensure(await approvePost(ctx.staff, input, socialDeps));
			await wakeTask("publish-social", { postId: post.id });
			return postDto(post);
		}),

	/** Reenfileira o que falhou e acorda a entrega, como na aprovação. */
	retry: publish
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const post = ensure(await retryPost(ctx.staff, input, socialDeps));
			await wakeTask("publish-social", { postId: post.id });
			return postDto(post);
		}),

	/**
	 * Escolhe (ou tira, com `templateId: null`) o padrão da arte de um destino.
	 * O post guarda a cópia do padrão como ele está agora (spec 09, D9).
	 */
	chooseArt: publish
		.input(
			z.object({
				id: z.string(),
				destination,
				templateId: z.string().nullable(),
				overrides: artOverrides.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			postDto(
				ensure(
					await choosePostArt(ctx.staff, input, {
						repo: socialDeps.repo,
						templates: templateDeps.templates,
					}),
				),
			),
		),

	/** Troca só os textos da arte de um destino, mantendo a cópia do padrão. */
	setArtOverrides: publish
		.input(z.object({ id: z.string(), destination, overrides: artOverrides }))
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await setPostArtOverrides(ctx.staff, input, socialDeps))),
		),

	/** Troca o que preenche as caixas da arte (título, chapéu, editoria). */
	setArtContent: publish
		.input(
			z.object({
				id: z.string(),
				content: z.object({
					headline: z.string().max(TEMPLATE_TEXT_MAX),
					kicker: z.string().max(TEMPLATE_TEXT_MAX).nullable(),
					sectionName: z.string().max(TEMPLATE_TEXT_MAX).nullable(),
				}),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			postDto(ensure(await setPostArtContent(ctx.staff, input, socialDeps))),
		),

	/**
	 * O post da matéria (spec 09, F6) — o que o editor da matéria mostra: se a
	 * matéria está no ar, se já tem post e em que estado, e o padrão de cada
	 * destino para a escolha já vir marcada.
	 */
	articlePost: publish
		.input(z.object({ articleId: z.string() }))
		.query(async ({ input }) => {
			const loaded = await loadArticleForSocial(input.articleId);
			if (!loaded) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Matéria não encontrada.",
				});
			}
			const [post, defaults] = await Promise.all([
				socialDeps.repo.findForArticle(input.articleId),
				Promise.all(
					SOCIAL_DESTINATIONS.map(
						async (item) =>
							[item, await defaultTemplateFor(item, templateDeps)] as const,
					),
				),
			]);
			return {
				published: loaded.published,
				coverMediaId: loaded.article.coverMediaId,
				content: {
					headline: loaded.article.headline,
					kicker: loaded.article.kicker ?? null,
					sectionName: loaded.article.sectionName,
				},
				post: post ? postDto(post) : null,
				defaults: Object.fromEntries(
					defaults.map(([item, template]) => [
						item,
						template ? { id: template.id, name: template.name } : null,
					]),
				) as Record<
					(typeof SOCIAL_DESTINATIONS)[number],
					{ id: string; name: string } | null
				>,
			};
		}),

	/**
	 * Prepara a publicação da matéria nas redes — rascunho ou aprovada —, com
	 * destinos e o padrão de cada um (spec 09, F6). Reaproveita o post da matéria
	 * se já houver. Aprovar só vale com a matéria no ar; aprovado, acorda o envio
	 * na hora, como a aprovação da fila (spec 08, D33).
	 */
	prepareFromArticle: publish
		.input(
			z.object({
				articleId: z.string(),
				destinations: z.array(destination).min(1),
				templates: z
					.object({
						INSTAGRAM: z.string().nullable(),
						INSTAGRAM_STORIES: z.string().nullable(),
						FACEBOOK: z.string().nullable(),
					})
					.partial()
					.optional(),
				approve: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const loaded = await loadArticleForSocial(input.articleId);
			if (!loaded) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Matéria não encontrada.",
				});
			}
			const post = ensure(
				await prepareArticlePost(
					ctx.staff,
					{
						article: loaded.article,
						articlePublished: loaded.published,
						destinations: input.destinations,
						templates: input.templates,
						approve: input.approve,
					},
					{
						repo: socialDeps.repo,
						templates: templateDeps.templates,
						clock: socialDeps.clock,
						ids: socialDeps.ids,
					},
				),
			);
			if (input.approve) {
				await wakeTask("publish-social", { postId: post.id });
			}
			return postDto(post);
		}),

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
	metaStatus: publish.query(() => ({
		configured: metaOAuth !== null,
		instagramFromEnvironment: isAccountFromEnvironment("INSTAGRAM"),
	})),

	/**
	 * "Cada rede consegue publicar agora?", respondido SEM publicar: consulta a
	 * Meta sobre o token e as permissões, lê a cota e confere se o armazenamento
	 * é alcançável. É o primeiro passo do roteiro do go-live (spec 08, §14).
	 *
	 * Query, e não mutation, porque não muda nada — mas a tela só a dispara no
	 * clique: cada chamada consulta a Meta.
	 */
	diagnose: publish.query(async ({ ctx }) =>
		ensure(await diagnoseAccounts(ctx.staff, diagnoseDeps)).map((item) => ({
			platform: item.platform,
			verdict: item.verdict,
			problems: [...item.problems],
			warnings: [...item.warnings],
			quota: item.quota,
		})),
	),

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
				// Com o Instagram vindo do `.env`, o login NÃO o substitui — e a tela
				// precisa dizer isso, senão "Página e Instagram conectados" mentiria.
				instagramFromEnvironment: isAccountFromEnvironment("INSTAGRAM"),
			};
		}),

	disconnect: manage
		.input(z.object({ platform }))
		.mutation(async ({ ctx, input }) => {
			if (isAccountFromEnvironment(input.platform)) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message:
						"Esta conta vem da configuração do ambiente (META_INSTAGRAM_*). Para desligá-la, remova as variáveis e reinicie o servidor.",
				});
			}
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
