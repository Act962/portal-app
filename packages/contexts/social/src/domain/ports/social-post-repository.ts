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
