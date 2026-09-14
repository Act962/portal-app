import { err, ok, type Result } from "@portal-app/shared-kernel";

import type { SocialPlatform } from "../domain/platform";
import type {
	AccountCredentials,
	SocialAccountRepository,
} from "../domain/ports/social-account-repository";
import { SocialAccount } from "../domain/social-account";

/**
 * O Instagram do cliente, configurado pelo ambiente (spec 08, §15).
 *
 * O token é o do **login do Instagram** (`IGAA…`), gerado no painel da Meta, e
 * fala com `graph.instagram.com`. Vale 60 dias: quem gera informa a validade, e
 * o painel avisa antes de vencer pela mesma regra de qualquer conta
 * (`SocialAccount.stateAt`).
 */
export type EnvironmentInstagram = {
	userId: string;
	accessToken: string;
	username: string | null;
	tokenExpiresAt: Date | null;
};

export type EnvironmentInstagramInput = {
	accessToken?: string;
	userId?: string;
	username?: string;
	tokenExpiresAt?: string;
};

/**
 * Lê as variáveis `META_INSTAGRAM_*`.
 *
 * - nenhuma das duas obrigatórias → `ok(null)`: o modo não está ligado, e o
 *   Instagram segue pelo login da Meta, como antes;
 * - só uma delas, id que não é número ou data inválida → `err` com a frase do
 *   que corrigir. Meia configuração não liga nada: publicar com o token certo
 *   no id errado mandaria o post para outra conta, ou para lugar nenhum.
 */
export function environmentInstagramFrom(
	input: EnvironmentInstagramInput,
): Result<EnvironmentInstagram | null, string> {
	const accessToken = input.accessToken?.trim() ?? "";
	const userId = input.userId?.trim() ?? "";

	if (!accessToken && !userId) {
		return ok(null);
	}
	if (!accessToken || !userId) {
		return err(
			"Defina META_INSTAGRAM_ACCESS_TOKEN e META_INSTAGRAM_USER_ID juntos — com só uma delas, o Instagram do ambiente fica desligado.",
		);
	}
	if (!/^\d+$/.test(userId)) {
		return err(
			"META_INSTAGRAM_USER_ID deve ser o id numérico da conta do Instagram (ex.: 17841400000000000), sem @.",
		);
	}

	let tokenExpiresAt: Date | null = null;
	if (input.tokenExpiresAt?.trim()) {
		const raw = input.tokenExpiresAt.trim();
		// Só a data ("2026-11-13") vira o FIM daquele dia em UTC. `new Date` a leria
		// como meia-noite UTC — que no Brasil ainda é o dia anterior, e o painel
		// mostraria a validade um dia mais curta do que a pessoa escreveu.
		tokenExpiresAt = new Date(
			/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59Z` : raw,
		);
		if (Number.isNaN(tokenExpiresAt.getTime())) {
			return err(
				"META_INSTAGRAM_TOKEN_EXPIRES_AT deve ser uma data no formato AAAA-MM-DD.",
			);
		}
	}

	const username = input.username?.trim().replace(/^@/, "") || null;
	return ok({ userId, accessToken, username, tokenExpiresAt });
}

/** O id fixo da conta do ambiente. Não existe no banco; é só um nome estável. */
export const ENVIRONMENT_INSTAGRAM_ACCOUNT_ID = "ambiente-instagram";

/**
 * Repositório de contas com o Instagram vindo do ambiente.
 *
 * **Decorador, e não um repositório novo:** o Facebook continua conectado pelo
 * login da Meta e guardado no banco, e todo o resto do módulo (worker,
 * diagnóstico, tela) continua falando com a mesma porta sem saber de onde a
 * conta veio. Por isso trocar o Instagram do `.env` pelo login, no dia do
 * go-live, é apagar as variáveis — nenhum código muda.
 *
 * Com o modo ligado, gravar ou desligar o Instagram por aqui é ignorado: a
 * verdade é o `.env`, e aceitar a gravação criaria uma segunda conta que o
 * painel mostraria e o worker não usaria.
 */
export class EnvironmentInstagramAccountRepository
	implements SocialAccountRepository
{
	constructor(
		private readonly inner: SocialAccountRepository,
		private readonly instagram: EnvironmentInstagram | null,
	) {}

	isManagedByEnvironment(platform: SocialPlatform): boolean {
		return platform === "INSTAGRAM" && this.instagram !== null;
	}

	connect(account: SocialAccount, accessToken: string): Promise<void> {
		return this.isManagedByEnvironment(account.platform)
			? Promise.resolve()
			: this.inner.connect(account, accessToken);
	}

	save(account: SocialAccount): Promise<void> {
		return this.isManagedByEnvironment(account.platform)
			? Promise.resolve()
			: this.inner.save(account);
	}

	findByPlatform(platform: SocialPlatform): Promise<SocialAccount | null> {
		const environment = this.environmentAccount(platform);
		return environment
			? Promise.resolve(environment)
			: this.inner.findByPlatform(platform);
	}

	async listAll(): Promise<readonly SocialAccount[]> {
		const stored = await this.inner.listAll();
		const environment = this.environmentAccount("INSTAGRAM");
		if (!environment) {
			return stored;
		}
		return [
			environment,
			...stored.filter((account) => account.platform !== "INSTAGRAM"),
		];
	}

	credentialsFor(platform: SocialPlatform): Promise<AccountCredentials | null> {
		if (this.instagram && this.isManagedByEnvironment(platform)) {
			return Promise.resolve({
				accountId: ENVIRONMENT_INSTAGRAM_ACCOUNT_ID,
				platform,
				accountRemoteId: this.instagram.userId,
				accessToken: this.instagram.accessToken,
			});
		}
		return this.inner.credentialsFor(platform);
	}

	/**
	 * Apaga o que estiver no BANCO. O token do ambiente não é apagável por
	 * código — quem pediu a exclusão precisa tirá-lo do `.env`, e a spec diz
	 * isso (§15).
	 */
	forget(platform: SocialPlatform): Promise<boolean> {
		return this.inner.forget(platform);
	}

	private environmentAccount(platform: SocialPlatform): SocialAccount | null {
		if (!this.instagram || !this.isManagedByEnvironment(platform)) {
			return null;
		}
		return SocialAccount.restore({
			id: ENVIRONMENT_INSTAGRAM_ACCOUNT_ID,
			platform: "INSTAGRAM",
			remoteId: this.instagram.userId,
			displayName: this.instagram.username
				? `@${this.instagram.username}`
				: `Instagram ${this.instagram.userId}`,
			avatarUrl: null,
			tokenExpiresAt: this.instagram.tokenExpiresAt,
			status: "CONECTADA",
			connectedAt: new Date(0),
			connectedByStaffId: "ambiente",
		});
	}
}
