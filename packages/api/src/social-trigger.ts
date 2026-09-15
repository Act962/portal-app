import { createPrismaClient } from "@portal-app/db";
import { PUBLISHED_STATUSES } from "@portal-app/editorial";
import { getSiteSettings } from "@portal-app/settings";
import { draftPostForArticle, type PublishedArticle } from "@portal-app/social";

import { settingsDeps } from "./settings";
import { AUTO_POST_PLATFORMS, socialDeps, templateDeps } from "./social";

const prisma = createPrismaClient();

export type ArticleForSocial = {
	article: PublishedArticle;
	/** A matéria está no ar? Só assim o link dela existe (spec 09, F6). */
	published: boolean;
};

/**
 * A matéria como o contexto de redes sociais a enxerga — um objeto plano.
 *
 * **É o módulo inteiro de integração com o editorial.** Reunir matéria,
 * editoria, tags e configuração do site é conhecimento de composição; o
 * contexto de redes sociais recebe o objeto e não sabe de onde veio, e
 * `contextos-isolados` continua verde porque a cola mora aqui.
 *
 * Usado pelo gatilho da matéria publicada e pelo editor da matéria (F6), que
 * precisa da MESMA montagem — o link, a legenda e a arte não podem sair
 * diferentes conforme o caminho.
 */
export async function loadArticleForSocial(
	articleId: string,
): Promise<ArticleForSocial | null> {
	const article = await prisma.article.findUnique({
		where: { id: articleId },
		select: {
			id: true,
			headline: true,
			kicker: true,
			standfirst: true,
			slug: true,
			authorName: true,
			sectionId: true,
			tagIds: true,
			coverMediaId: true,
			status: true,
		},
	});
	if (!article) {
		return null;
	}

	const [section, tags, settings] = await Promise.all([
		article.sectionId
			? prisma.section.findUnique({
					where: { id: article.sectionId },
					select: { name: true, slug: true },
				})
			: null,
		article.tagIds.length > 0
			? prisma.tag.findMany({
					where: { id: { in: article.tagIds } },
					select: { name: true },
				})
			: [],
		getSiteSettings(settingsDeps),
	]);

	return {
		article: {
			id: article.id,
			headline: article.headline,
			kicker: article.kicker || null,
			standfirst: article.standfirst || null,
			sectionName: section?.name ?? null,
			authorName: article.authorName,
			tags: tags.map((tag) => tag.name),
			// O mesmo endereço que o portal publica (`routes.article`). Montado à
			// mão porque `apps/web` não é importável daqui — e a duplicação de uma
			// interpolação é mais barata que a dependência invertida.
			url: section
				? `${settings.data.url.replace(/\/$/, "")}/${section.slug}/${article.slug}`
				: null,
			siteName: settings.data.name,
			coverMediaId: article.coverMediaId,
		},
		// A lista de "no ar" é do editorial (PUBLICADA e ATUALIZADA) — repetida
		// aqui, divergiria no dia em que o fluxo ganhasse um estado.
		published: (PUBLISHED_STATUSES as readonly string[]).includes(
			article.status,
		),
	};
}

/**
 * Matéria publicada vira rascunho de post (spec 08, D1), já com a arte do
 * padrão de cada destino (spec 09, D2). Assina um evento que já era emitido
 * antes desta fase existir — nenhuma linha do contexto editorial foi tocada.
 */
export async function draftSocialPostForArticle(
	articleId: string,
): Promise<void> {
	const loaded = await loadArticleForSocial(articleId);
	if (!loaded) {
		return;
	}
	await draftPostForArticle(loaded.article, {
		repo: socialDeps.repo,
		clock: socialDeps.clock,
		ids: socialDeps.ids,
		platforms: AUTO_POST_PLATFORMS,
		templates: templateDeps.templates,
	});
}
