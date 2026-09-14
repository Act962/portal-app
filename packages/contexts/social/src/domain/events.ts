import { DomainEvent } from "@portal-app/shared-kernel";

import type { SocialPlatform } from "./platform";

/**
 * Os eventos deste contexto existem para a AUDITORIA: eles entram no mesmo
 * outbox do editorial e viram registro imutável de "o que este veículo disse
 * nas redes, quando, e a mando de quem". Publicação em rede social é fala
 * pública do veículo — precisa de rastro pelo mesmo motivo que publicar matéria
 * precisa.
 */

export class SocialPostDrafted extends DomainEvent {
	readonly eventName = "SocialPostDrafted";
	constructor(
		readonly postId: string,
		readonly articleId: string | null,
		readonly platforms: readonly SocialPlatform[],
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
		readonly platforms: readonly SocialPlatform[],
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class SocialPostPublished extends DomainEvent {
	readonly eventName = "SocialPostPublished";
	constructor(
		readonly postId: string,
		readonly platform: SocialPlatform,
		readonly remoteId: string,
		readonly permalink: string | null,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

export class SocialPostFailed extends DomainEvent {
	readonly eventName = "SocialPostFailed";
	constructor(
		readonly postId: string,
		readonly platform: SocialPlatform,
		readonly reason: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}
