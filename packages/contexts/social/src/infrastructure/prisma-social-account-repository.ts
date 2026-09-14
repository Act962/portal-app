import type { PrismaClient } from "@portal-app/db/client";

import type { SocialPlatform } from "../domain/platform";
import type {
	AccountCredentials,
	SocialAccountRepository,
} from "../domain/ports/social-account-repository";
import { type AccountStatus, SocialAccount } from "../domain/social-account";
import type { TokenCipher } from "./token-cipher";

/**
 * Adapter Prisma das contas conectadas.
 *
 * É o **único** lugar do sistema que lê a coluna `accessToken` e o único que
 * conhece o `TokenCipher`. Tudo o mais fala com `SocialAccount`, que não tem
 * token nenhum (spec 08, D9).
 */
export class PrismaSocialAccountRepository implements SocialAccountRepository {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly cipher: TokenCipher,
	) {}

	/**
	 * Reconectar a MESMA rede substitui a conta anterior — o `platform` é único
	 * no banco (D5). É o comportamento certo: quem refaz o login da Meta está
	 * dizendo "é esta conta agora", e uma segunda linha só criaria a pergunta de
	 * qual das duas publica.
	 */
	async connect(account: SocialAccount, accessToken: string): Promise<void> {
		const data = {
			...toPersistence(account),
			accessToken: this.cipher.encrypt(accessToken),
		};
		await this.prisma.socialAccount.upsert({
			where: { platform: account.platform },
			create: data,
			update: data,
		});
	}

	/** Atualiza o agregado sem tocar no token — o `accessToken` nem entra no
	 * `update`, então é impossível apagá-lo por descuido. */
	async save(account: SocialAccount): Promise<void> {
		await this.prisma.socialAccount.update({
			where: { id: account.id },
			data: toPersistence(account),
		});
	}

	async findByPlatform(
		platform: SocialPlatform,
	): Promise<SocialAccount | null> {
		const row = await this.prisma.socialAccount.findUnique({
			where: { platform },
		});
		return row ? toDomain(row) : null;
	}

	async listAll(): Promise<readonly SocialAccount[]> {
		const rows = await this.prisma.socialAccount.findMany({
			orderBy: { platform: "asc" },
		});
		return rows.map(toDomain);
	}

	async credentialsFor(
		platform: SocialPlatform,
	): Promise<AccountCredentials | null> {
		const row = await this.prisma.socialAccount.findUnique({
			where: { platform },
		});
		if (row?.status !== "CONECTADA") {
			return null;
		}
		return {
			accountId: row.id,
			platform: row.platform as SocialPlatform,
			accountRemoteId: row.remoteId,
			accessToken: this.cipher.decrypt(row.accessToken),
		};
	}
}

type AccountRow = {
	id: string;
	platform: string;
	remoteId: string;
	displayName: string;
	avatarUrl: string | null;
	tokenExpiresAt: Date | null;
	status: string;
	connectedAt: Date;
	connectedByStaffId: string;
};

function toPersistence(account: SocialAccount) {
	return {
		id: account.id,
		platform: account.platform,
		remoteId: account.remoteId,
		displayName: account.displayName,
		avatarUrl: account.avatarUrl,
		tokenExpiresAt: account.tokenExpiresAt,
		status: account.status,
		connectedAt: account.connectedAt,
		connectedByStaffId: account.connectedByStaffId,
	};
}

function toDomain(row: AccountRow): SocialAccount {
	return SocialAccount.restore({
		id: row.id,
		platform: row.platform as SocialPlatform,
		remoteId: row.remoteId,
		displayName: row.displayName,
		avatarUrl: row.avatarUrl,
		tokenExpiresAt: row.tokenExpiresAt,
		status: row.status as AccountStatus,
		connectedAt: row.connectedAt,
		connectedByStaffId: row.connectedByStaffId,
	});
}
