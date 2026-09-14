import type { SocialPlatform } from "../../domain/platform";
import type {
	ConnectionInspection,
	ConnectionProbe,
} from "../../domain/ports/connection-probe";
import type { AccountCredentials } from "../../domain/ports/social-account-repository";
import type { MetaGraphClient } from "./graph-client";
import { readInstagramQuota } from "./publishing-quota";

/**
 * O que cada rede precisa ter recebido no login para publicar.
 *
 * Um subconjunto de `META_SCOPES`: `business_management` só serve para LISTAR
 * Páginas de Portfólio no login, e não faz falta depois de conectada.
 */
export const REQUIRED_SCOPES: Record<SocialPlatform, readonly string[]> = {
	INSTAGRAM: ["instagram_basic", "instagram_content_publish"],
	FACEBOOK: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
};

type DebugTokenResponse = {
	data?: { is_valid?: boolean; scopes?: string[] };
};

/**
 * Adapter da porta `ConnectionProbe` pela Graph API.
 *
 * Usa `GET /debug_token`, que responde se o token vale e quais permissões ele
 * carrega, e — no Instagram — a cota de publicação. Nenhuma das duas chamadas
 * publica nem altera nada na conta.
 *
 * O `debug_token` exige um token DO APP, que é `{app-id}|{app-secret}`: é a
 * forma documentada, e ela nunca sai do servidor. O cliente não coloca a URL da
 * chamada em mensagem de erro, então o segredo não vaza por aqui.
 */
export class MetaConnectionProbe implements ConnectionProbe {
	constructor(
		private readonly deps: {
			client: MetaGraphClient;
			appId: string;
			appSecret: string;
		},
	) {}

	async inspect(
		credentials: AccountCredentials,
	): Promise<ConnectionInspection> {
		const { client, appId, appSecret } = this.deps;

		const debug = await client.get<DebugTokenResponse>(
			"debug_token",
			{ input_token: credentials.accessToken },
			`${appId}|${appSecret}`,
		);
		if (debug.isErr()) {
			return {
				problems: [
					`Não foi possível consultar a Meta agora: ${debug.unwrapErr().message}`,
				],
				quota: null,
			};
		}

		const data = debug.unwrap().data;
		if (!data?.is_valid) {
			return {
				problems: [
					"A Meta informa que a autorização não vale mais (senha trocada, acesso removido ou App desinstalado). Reconecte com a Meta.",
				],
				quota: null,
			};
		}

		const granted = new Set(data.scopes ?? []);
		const missing = REQUIRED_SCOPES[credentials.platform].filter(
			(scope) => !granted.has(scope),
		);
		const problems =
			missing.length > 0
				? [
						`Faltam permissões no login: ${missing.join(", ")}. Reconecte com a Meta aceitando todas.`,
					]
				: [];

		const quota =
			credentials.platform === "INSTAGRAM"
				? await readInstagramQuota(
						client,
						credentials.accountRemoteId,
						credentials.accessToken,
					)
				: null;

		return { problems, quota };
	}
}
