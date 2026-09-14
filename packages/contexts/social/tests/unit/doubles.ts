import { StaffMember } from "@portal-app/identity";
import type { Page, PageRequest } from "@portal-app/shared-kernel";
import { err, ok, type Result } from "@portal-app/shared-kernel";
import {
	type AccountCredentials,
	type ConnectionInspection,
	type ConnectionProbe,
	destinationOf,
	type PublishableImage,
	type PublishFailure,
	type PublishRequest,
	type PublishSuccess,
	type SocialAccount,
	type SocialAccountRepository,
	type SocialDestination,
	type SocialImageSource,
	type SocialPlatform,
	type SocialPost,
	type SocialPostFilter,
	type SocialPostRepository,
	type SocialPublisher,
} from "@portal-app/social";

/**
 * Dublês das portas do contexto.
 *
 * Moram em `tests/` e não no `src/` porque, ao contrário dos fakes que a Fase 2
 * publicou junto das portas (`InMemoryMediaStorage`), estes não são parte do
 * contrato: não existe um teste de contrato "fake ↔ real" para eles ainda. Ele
 * chega na F4, junto do adapter da Meta.
 */

export class InMemorySocialPostRepository implements SocialPostRepository {
	readonly posts = new Map<string, SocialPost>();

	save(post: SocialPost): Promise<void> {
		this.posts.set(post.id, post);
		return Promise.resolve();
	}

	findById(id: string): Promise<SocialPost | null> {
		return Promise.resolve(this.posts.get(id) ?? null);
	}

	list(filter: SocialPostFilter, page: PageRequest): Promise<Page<SocialPost>> {
		const all = [...this.posts.values()].filter(
			(post) =>
				(!filter.status || post.status === filter.status) &&
				(!filter.articleId || post.articleId === filter.articleId) &&
				(!filter.platform || post.targets.includes(filter.platform)),
		);
		return Promise.resolve({
			items: all.slice(page.offset, page.offset + page.limit),
			total: all.length,
		});
	}

	existsForArticle(articleId: string): Promise<boolean> {
		return Promise.resolve(
			[...this.posts.values()].some(
				(post) => post.articleId === articleId && post.origin === "AUTOMATICA",
			),
		);
	}

	countPending(): Promise<number> {
		return Promise.resolve(
			[...this.posts.values()].filter((post) => post.status === "RASCUNHO")
				.length,
		);
	}

	listAwaitingDelivery(limit: number): Promise<readonly SocialPost[]> {
		return Promise.resolve(
			[...this.posts.values()]
				.filter(
					(post) =>
						post.status === "PUBLICANDO" && post.pendingDeliveries().length > 0,
				)
				.slice(0, limit),
		);
	}
}

export class InMemorySocialAccountRepository
	implements SocialAccountRepository
{
	readonly accounts = new Map<SocialPlatform, SocialAccount>();
	readonly tokens = new Map<string, string>();

	connect(account: SocialAccount, accessToken: string): Promise<void> {
		this.accounts.set(account.platform, account);
		this.tokens.set(account.id, accessToken);
		return Promise.resolve();
	}

	save(account: SocialAccount): Promise<void> {
		this.accounts.set(account.platform, account);
		return Promise.resolve();
	}

	findByPlatform(platform: SocialPlatform): Promise<SocialAccount | null> {
		return Promise.resolve(this.accounts.get(platform) ?? null);
	}

	listAll(): Promise<readonly SocialAccount[]> {
		return Promise.resolve([...this.accounts.values()]);
	}

	credentialsFor(platform: SocialPlatform): Promise<AccountCredentials | null> {
		const account = this.accounts.get(platform);
		if (!account) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			accountId: account.id,
			platform,
			accountRemoteId: account.remoteId,
			accessToken: this.tokens.get(account.id) ?? "",
		});
	}

	forget(platform: SocialPlatform): Promise<boolean> {
		const account = this.accounts.get(platform);
		if (!account) {
			return Promise.resolve(false);
		}
		account.disconnect();
		this.tokens.delete(account.id);
		return Promise.resolve(true);
	}
}

/** Sonda programável: devolve a inspeção que mandarem, por rede. */
export class FakeConnectionProbe implements ConnectionProbe {
	readonly inspected: SocialPlatform[] = [];
	private readonly replies = new Map<SocialPlatform, ConnectionInspection>();

	reply(platform: SocialPlatform, inspection: Partial<ConnectionInspection>) {
		this.replies.set(platform, { problems: [], quota: null, ...inspection });
		return this;
	}

	inspect(credentials: AccountCredentials): Promise<ConnectionInspection> {
		this.inspected.push(credentials.platform);
		return Promise.resolve(
			this.replies.get(credentials.platform) ?? { problems: [], quota: null },
		);
	}
}

/** Publisher programável: registra o que recebeu e devolve o que mandarem —
 * por DESTINO, para o feed e os Stories do Instagram responderem diferente. */
export class SpySocialPublisher implements SocialPublisher {
	readonly requests: PublishRequest[] = [];
	private readonly outcomes = new Map<
		SocialDestination,
		Result<PublishSuccess, PublishFailure>
	>();

	succeedOn(
		destination: SocialDestination,
		remoteId: string,
		permalink = null,
	) {
		this.outcomes.set(destination, ok({ remoteId, permalink }));
		return this;
	}

	failOn(destination: SocialDestination, reason: string, retryable = false) {
		this.outcomes.set(
			destination,
			err<PublishSuccess, PublishFailure>({ reason, retryable }),
		);
		return this;
	}

	publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		this.requests.push(request);
		const destination =
			destinationOf(request.platform, request.format) ?? request.platform;
		return Promise.resolve(
			this.outcomes.get(destination) ??
				ok({ remoteId: `remote-${destination}`, permalink: null }),
		);
	}
}

/** Fonte de imagem que resolve tudo, menos os ids que mandarem sumir. */
export class FakeImageSource implements SocialImageSource {
	readonly missing = new Set<string>();
	/** As proporções pedidas, na ordem — o story pede 9:16, o feed 1:1. */
	readonly aspects: string[] = [];
	/** Troque para simular o armazenamento de dev (`http://localhost:9000/...`). */
	baseUrl = "https://cdn.test";

	resolve(mediaId: string, aspect = "1:1"): Promise<PublishableImage | null> {
		this.aspects.push(aspect);
		if (this.missing.has(mediaId)) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			url: `${this.baseUrl}/${mediaId}.jpg`,
			altText: `alt de ${mediaId}`,
		});
	}
}

export function staff(
	role: "ADMIN" | "EDITOR" | "REDATOR",
	id = `${role.toLowerCase()}-1`,
): StaffMember {
	return StaffMember.restore({
		id,
		email: `${id}@fm7cidades.com.br`,
		role,
		sectionIds: [],
		status: "ATIVO",
	});
}
