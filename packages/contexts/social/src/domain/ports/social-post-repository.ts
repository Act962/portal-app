import type { Page, PageRequest } from "@portal-app/shared-kernel";

import type { SocialDestination } from "../platform";
import type { PostStatus, SocialPost } from "../social-post";

export type SocialPostFilter = {
	status?: PostStatus;
	/** O destino exato: filtrar por `INSTAGRAM` não traz quem só vai aos Stories. */
	platform?: SocialDestination;
	articleId?: string;
};

export interface SocialPostRepository {
	save(post: SocialPost): Promise<void>;
	findById(id: string): Promise<SocialPost | null>;
	list(filter: SocialPostFilter, page: PageRequest): Promise<Page<SocialPost>>;

	/**
	 * Já existe post para esta matéria?
	 *
	 * É a trava contra duplicata na entrada automática. O gatilho é o evento
	 * `ArticlePublished`, que chega pelo outbox — e o outbox garante entrega *ao
	 * menos uma vez*, não *exatamente uma vez*. Uma matéria despublicada e
	 * republicada também dispara o evento de novo. Sem esta pergunta, a fila
	 * acumularia o mesmo post duas vezes e alguém aprovaria os dois.
	 */
	existsForArticle(articleId: string): Promise<boolean>;

	/**
	 * O post DA matéria — o automático ou o preparado no editor da matéria
	 * (origem `MATERIA`, spec 09, F6). `null` quando não há. Posts MANUAIS da
	 * fila não contam: são avulsos.
	 *
	 * É o que deixa o editor da matéria reaproveitar o rascunho automático em
	 * vez de criar um segundo post para a mesma notícia.
	 */
	findForArticle(articleId: string): Promise<SocialPost | null>;

	/** Quantos posts esperam aprovação — é o número do badge na navegação. */
	countPending(): Promise<number>;

	/**
	 * Os posts aprovados que ainda têm entrega pendente — a fila do worker.
	 *
	 * Existe como consulta própria, e não como um `list({ status: "PUBLICANDO" })`,
	 * porque o worker precisa de um TETO: uma rodada que tentasse enviar tudo o
	 * que está preso encostaria no limite de 100 posts/24 h da Meta em minutos,
	 * e as tentativas queimadas não voltam.
	 */
	listAwaitingDelivery(limit: number): Promise<readonly SocialPost[]>;
}
