import { DomainEvent } from "@portal-app/shared-kernel";

import type { SocialDestination } from "./platform";

/**
 * Os eventos deste contexto existem para a AUDITORIA: eles entram no mesmo
 * outbox do editorial e viram registro imutável de "o que este veículo disse
 * nas redes, quando, e a mando de quem". Publicação em rede social é fala
 * pública do veículo — precisa de rastro pelo mesmo motivo que publicar matéria
 * precisa.
 *
 * Os campos continuam se chamando `platform`/`platforms` mesmo guardando um
 * DESTINO (§17): o payload já está gravado no outbox e na auditoria com esse
 * nome, e os valores antigos (`INSTAGRAM`, `FACEBOOK`) seguem válidos.
 */

export class SocialPostDrafted extends DomainEvent {
	readonly eventName = "SocialPostDrafted";
	constructor(
		readonly postId: string,
		readonly articleId: string | null,
		readonly platforms: readonly SocialDestination[],
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class SocialPostApproved extends DomainEvent {
	readonly eventName = "SocialPostApproved";
	constructor(
		readonly postId: string,
		readonly approvedByStaffId: string,
		readonly platforms: readonly SocialDestination[],
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

/**
 * Uma entrega foi ao ar. Na publicação manual (spec 11, D7), `remoteId` é nulo e
 * `publishedByStaffId` diz quem publicou pelo app — é a prova que a auditoria
 * guarda no lugar do id da rede.
 */
export class SocialPostPublished extends DomainEvent {
	readonly eventName = "SocialPostPublished";
	constructor(
		readonly postId: string,
		readonly platform: SocialDestination,
		readonly remoteId: string | null,
		readonly permalink: string | null,
		occurredAt: Date,
		readonly publishedByStaffId: string | null = null,
	) {
		super(occurredAt);
	}
}

/** Alguém decidiu não publicar uma entrega (spec 11, D3). */
export class SocialDeliveryDismissed extends DomainEvent {
	readonly eventName = "SocialDeliveryDismissed";
	constructor(
		readonly postId: string,
		readonly platform: SocialDestination,
		readonly dismissedByStaffId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class SocialPostFailed extends DomainEvent {
	readonly eventName = "SocialPostFailed";
	constructor(
		readonly postId: string,
		readonly platform: SocialDestination,
		readonly reason: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}
