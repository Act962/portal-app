import { createPrismaClient } from "@portal-app/db";
import { getSiteSettings } from "@portal-app/settings";
import { draftPostForArticle } from "@portal-app/social";

import { settingsDeps } from "./settings";
import { AUTO_POST_PLATFORMS, socialDeps, templateDeps } from "./social";

const prisma = createPrismaClient();

/**
 * Matéria publicada vira rascunho de post (spec 08, D1).
 *
 * **É o módulo inteiro de integração com o editorial.** Ele assina um evento
 * que já era emitido antes desta fase existir — nenhuma linha do contexto
 * editorial foi tocada, e `contextos-isolados` continua verde porque a cola
 * mora aqui, na raiz de composição, e não dentro de um contexto.
 *
 * A montagem dos dados da matéria acontece AQUI pelo mesmo motivo: reunir
 * matéria, editoria, tags e configuração do site é conhecimento de composição.
 * O contexto de redes sociais recebe um objeto plano e não sabe de onde veio.
 */
export async function draftSocialPostForArticle(
	articleId: string,
): Promise<void> {
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
		},
	});
	if (!article) {
		return;
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

	await draftPostForArticle(
		{
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
		{
			repo: socialDeps.repo,
			clock: socialDeps.clock,
			ids: socialDeps.ids,
			platforms: AUTO_POST_PLATFORMS,
			// O rascunho nasce com a arte do padrão de cada destino (spec 09, D2).
			templates: templateDeps.templates,
		},
	);
}
