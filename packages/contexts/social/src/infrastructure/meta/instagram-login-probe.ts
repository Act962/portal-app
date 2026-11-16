import type {
	ConnectionInspection,
	ConnectionProbe,
} from "../../domain/ports/connection-probe";
import type { AccountCredentials } from "../../domain/ports/social-account-repository";
import { instagramTokenHost } from "../environment-instagram";
import type { GraphError, MetaGraphClient } from "./graph-client";
import { readInstagramQuota } from "./publishing-quota";

type MeResponse = { user_id?: string | number; username?: string };
type AccountResponse = { id?: string | number; username?: string };

/**
 * A sonda do Instagram configurado pelo ambiente.
 *
 * O `debug_token` da outra sonda precisa da chave do App, que este modo não
 * tem. A pergunta depende do tipo de token (`instagramTokenHost`):
 *
 * - `IGAA…` (login do Instagram, `graph.instagram.com`): `GET /me`, que
 *   responde de quem o token é — e isso pega o erro mais provável de uma
 *   configuração à mão: token de uma conta e `META_INSTAGRAM_USER_ID` de outra;
 * - `EAA…` (login unificado, `graph.facebook.com`): ali o `/me` é o usuário do
 *   Facebook, sem `user_id`. A pergunta é `GET /{id-da-conta}`: se o token não
 *   alcança aquela conta, a Meta recusa — o mesmo erro pego por outro caminho.
 *
 * O `client` precisa apontar para o host do token; quem monta é o `social.ts`.
 */
export class InstagramLoginProbe implements ConnectionProbe {
	constructor(private readonly deps: { client: MetaGraphClient }) {}

	async inspect(
		credentials: AccountCredentials,
	): Promise<ConnectionInspection> {
		const { client } = this.deps;

		if (instagramTokenHost(credentials.accessToken) === "FACEBOOK") {
			return this.inspectFacebookToken(credentials);
		}

		const me = await client.get<MeResponse>(
			"me",
			{ fields: "user_id,username" },
			credentials.accessToken,
		);
		if (me.isErr()) {
			return { problems: [describeError(me.unwrapErr())], quota: null };
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

		return this.healthy(credentials);
	}

	private async inspectFacebookToken(
		credentials: AccountCredentials,
	): Promise<ConnectionInspection> {
		const account = await this.deps.client.get<AccountResponse>(
			credentials.accountRemoteId,
			{ fields: "id,username" },
			credentials.accessToken,
		);
		if (account.isErr()) {
			const error = account.unwrapErr();
			// 100 (objeto inexistente ou sem permissão) e 10/200 (permissão): o
			// token vale, mas não alcança a conta configurada.
			if (error.code === 100 || error.code === 10 || error.code === 200) {
				return {
					problems: [
						"A autorização não dá acesso a esta conta do Instagram. Peça ao administrador do sistema para revisar a configuração.",
					],
					quota: null,
				};
			}
			return { problems: [describeError(error)], quota: null };
		}
		return this.healthy(credentials);
	}

	private async healthy(
		credentials: AccountCredentials,
	): Promise<ConnectionInspection> {
		return {
			problems: [],
			quota: await readInstagramQuota(
				this.deps.client,
				credentials.accountRemoteId,
				credentials.accessToken,
			),
		};
	}
}

function describeError(error: GraphError): string {
	return error.code === 190
		? "A autorização do Instagram é inválida ou venceu. Peça ao administrador do sistema para renová-la."
		: `Não foi possível consultar o Instagram agora: ${error.message}`;
}
