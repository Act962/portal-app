import type { Clock, IdGenerator } from "@portal-app/shared-kernel";

import {
	type CaptionContext,
	DEFAULT_CAPTION_TEMPLATE,
	renderCaption,
} from "../domain/caption-template";
import type { SocialDestination } from "../domain/platform";
import type { ArtTemplateRepository } from "../domain/ports/art-template-repository";
import type { SocialPostRepository } from "../domain/ports/social-post-repository";
import type { ArtSelections, SocialPost } from "../domain/social-post";
import { SocialPost as Post } from "../domain/social-post";
import { selectionFrom } from "../domain/template/art-selection";

/**
 * Tudo o que este contexto precisa saber sobre uma matéria publicada.
 *
 * É um objeto SIMPLES, montado pela raiz de composição. Fosse o agregado
 * `Article`, o contexto de redes sociais importaria o editorial e a regra
 * `contextos-isolados` cairia — e, pior, este módulo passaria a quebrar toda vez
 * que a matéria ganhasse um campo.
 */
export type PublishedArticle = CaptionContext & {
	id: string;
	/** O chapéu ("ÚLTIMAS") — vai para a caixa de chapéu da arte (spec 09). */
	kicker?: string | null;
	/** A capa. Nulo é possível, e o rascunho nasce assim mesmo (ver abaixo). */
	coverMediaId: string | null;
};

export type DraftFromArticleDeps = {
	repo: SocialPostRepository;
	clock: Clock;
	ids: IdGenerator;
	/** Os destinos que recebem o post automático (feed, Stories). */
	platforms: readonly SocialDestination[];
	/**
	 * De onde vem o padrão de cada destino (spec 09, D2). Sem ele, o rascunho
	 * nasce sem arte, como antes dos padrões.
	 */
	templates?: Pick<ArtTemplateRepository, "findDefaultFor">;
	/** O modelo da legenda. Injetado para a tela de configuração poder trocá-lo
	 * sem que este módulo saiba onde ele é guardado. */
	template?: string;
};

/**
 * O gatilho: matéria publicada vira rascunho de post.
 *
 * Chamado pelo assinante de `ArticlePublished`, na raiz de composição. Três
 * decisões moram aqui:
 *
 * **Devolve `null` quando já existe.** O outbox entrega *ao menos uma vez*, e
 * uma matéria despublicada e republicada dispara o evento de novo. Sem esta
 * pergunta, a fila acumularia o mesmo post duas vezes e alguém aprovaria os
 * dois. (A corrida — dois relays em paralelo — é barrada pelo índice único
 * `autoKey` no banco; esta checagem cobre o caso normal sem depender de exceção
 * de constraint.)
 *
 * **Matéria sem capa gera rascunho assim mesmo**, sem imagem. A alternativa —
 * pular em silêncio — faria a notícia simplesmente não existir na fila, e
 * ninguém procura o que não sabe que falta. Com o rascunho criado, o
 * impedimento "precisa de ao menos uma imagem" aparece na tela e alguém escolhe
 * uma.
 *
 * **Nasce RASCUNHO** (D1). Nada sai sem um humano ler.
 */
export async function draftPostForArticle(
	article: PublishedArticle,
	deps: DraftFromArticleDeps,
): Promise<SocialPost | null> {
	if (await deps.repo.existsForArticle(article.id)) {
		return null;
	}

	const captionText = renderCaption(
		deps.template ?? DEFAULT_CAPTION_TEMPLATE,
		article,
	);

	// O padrão de cada destino, copiado para o post (D9). Destino sem padrão
	// fica sem arte e sai com a foto cortada.
	const art: ArtSelections = {};
	if (deps.templates) {
		for (const destination of deps.platforms) {
			const template = await deps.templates.findDefaultFor(destination);
			if (template) {
				art[destination] = selectionFrom(template);
			}
		}
	}

	const post = Post.draft({
		id: deps.ids.generate(),
		art,
		// Copiado da matéria agora: se ela for corrigida depois, a arte do post
		// não muda sozinha — quem aprova vê e decide (D9).
		artContent: {
			headline: article.headline,
			kicker: article.kicker?.trim() ? article.kicker.trim() : null,
			sectionName: article.sectionName,
		},
		articleId: article.id,
		origin: "AUTOMATICA",
		captionText,
		mediaIds: article.coverMediaId ? [article.coverMediaId] : [],
		linkUrl: article.url,
		platforms: deps.platforms,
		createdAt: deps.clock.now(),
	});

	if (post.isErr()) {
		// Só acontece se a matéria não tiver título — o que o editorial já
		// impede para publicar. Devolver `null` em vez de lançar é deliberado:
		// este código roda dentro do despacho do outbox, e uma exceção aqui
		// travaria a entrega de TODOS os eventos seguintes, inclusive os da
		// auditoria. A notícia vale mais que o post.
		return null;
	}

	await deps.repo.save(post.value);
	return post.value;
}
