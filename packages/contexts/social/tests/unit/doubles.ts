import { StaffMember } from "@portal-app/identity";
import type { Page, PageRequest } from "@portal-app/shared-kernel";
import { err, ok, type Result } from "@portal-app/shared-kernel";
import type {
	AccountCredentials,
	PublishableImage,
	PublishFailure,
	PublishRequest,
	PublishSuccess,
	SocialAccount,
	SocialAccountRepository,
	SocialImageSource,
	SocialPlatform,
	SocialPost,
	SocialPostFilter,
	SocialPostRepository,
	SocialPublisher,
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
}

/** Publisher programável: registra o que recebeu e devolve o que mandarem. */
export class SpySocialPublisher implements SocialPublisher {
	readonly requests: PublishRequest[] = [];
	private readonly outcomes = new Map<
		SocialPlatform,
		Result<PublishSuccess, PublishFailure>
	>();

	succeedOn(platform: SocialPlatform, remoteId: string, permalink = null) {
		this.outcomes.set(platform, ok({ remoteId, permalink }));
		return this;
	}

	failOn(platform: SocialPlatform, reason: string, retryable = true) {
		this.outcomes.set(
			platform,
			err<PublishSuccess, PublishFailure>({ reason, retryable }),
		);
		return this;
	}

	publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		this.requests.push(request);
		return Promise.resolve(
			this.outcomes.get(request.platform) ??
				ok({ remoteId: `remote-${request.platform}`, permalink: null }),
		);
	}
}

/** Fonte de imagem que resolve tudo, menos os ids que mandarem sumir. */
export class FakeImageSource implements SocialImageSource {
	readonly missing = new Set<string>();

	resolve(mediaId: string): Promise<PublishableImage | null> {
		if (this.missing.has(mediaId)) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			url: `https://cdn.local/${mediaId}.jpg`,
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
