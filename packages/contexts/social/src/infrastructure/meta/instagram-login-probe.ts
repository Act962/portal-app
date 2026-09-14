import type {
	ConnectionInspection,
	ConnectionProbe,
} from "../../domain/ports/connection-probe";
import type { AccountCredentials } from "../../domain/ports/social-account-repository";
import type { MetaGraphClient } from "./graph-client";
import { readInstagramQuota } from "./publishing-quota";

type MeResponse = { user_id?: string | number; username?: string };

/**
 * A sonda do Instagram configurado pelo ambiente, com token do **login do
 * Instagram** (`graph.instagram.com`).
 *
 * O `debug_token` da outra sonda não serve para este tipo de token. Aqui a
 * pergunta é `GET /me`, que responde de quem o token é — e isso pega o erro
 * mais provável de uma configuração à mão: token de uma conta e
 * `META_INSTAGRAM_USER_ID` de outra.
 */
export class InstagramLoginProbe implements ConnectionProbe {
	constructor(private readonly deps: { client: MetaGraphClient }) {}

	async inspect(
		credentials: AccountCredentials,
	): Promise<ConnectionInspection> {
		const { client } = this.deps;

		const me = await client.get<MeResponse>(
			"me",
			{ fields: "user_id,username" },
			credentials.accessToken,
		);
		if (me.isErr()) {
			const error = me.unwrapErr();
			return {
				problems: [
					error.code === 190
						? "A autorização do Instagram é inválida ou venceu. Peça ao administrador do sistema para renová-la."
						: `Não foi possível consultar o Instagram agora: ${error.message}`,
				],
				quota: null,
			};
		}

		const { user_id: userId, username } = me.unwrap();
		if (
			userId !== undefined &&
			String(userId) !== credentials.accountRemoteId
		) {
			return {
				problems: [
					// Sem ids nem nomes de configuração: o diagnóstico aparece no painel.
					`A autorização é de outra conta do Instagram${username ? ` (@${username})` : ""}. Peça ao administrador do sistema para revisar a configuração.`,
				],
				quota: null,
			};
		}

		return {
			problems: [],
			quota: await readInstagramQuota(
				client,
				credentials.accountRemoteId,
				credentials.accessToken,
			),
		};
	}
}
