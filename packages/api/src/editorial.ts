import { createPrismaClient } from "@portal-app/db";
import type { ArticleRepository } from "@portal-app/editorial";
import { PrismaArticleRepository } from "@portal-app/editorial/infrastructure/prisma-article-repository";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";
import type { ContentUsage } from "@portal-app/taxonomy";

/**
 * Raiz de composição do editorial. Também é AQUI que se fecha o D5 da Fase 2: a
 * porta `ContentUsage` da taxonomia (que estava com `StubNoUsage`) ganha a
 * implementação real, consultando o editorial. A cola vive na composição, então
 * `editorial` e `taxonomy` continuam sem se importar — a seta do context map
 * fica correta e `contextos-isolados` permanece verde.
 */
const prisma = createPrismaClient();

export const articleRepo: ArticleRepository = new PrismaArticleRepository(prisma);

/** Dependências dos casos de uso do editorial (relógio real em produção). */
export const articleDeps = {
	repo: articleRepo,
	clock: new SystemClock(),
	ids: new UuidGenerator(),
};

class EditorialContentUsage implements ContentUsage {
	constructor(private readonly articles: ArticleRepository) {}

	async sectionHasPublishedContent(sectionId: string): Promise<boolean> {
		return (await this.articles.countPublishedInSection(sectionId)) > 0;
	}

	async tagHasPublishedContent(tagId: string): Promise<boolean> {
		return (await this.articles.countPublishedWithTag(tagId)) > 0;
	}
}

/** Injetado no `sectionDeps`/`tagDeps` da taxonomia, no lugar do `StubNoUsage`. */
export const contentUsage: ContentUsage = new EditorialContentUsage(articleRepo);
