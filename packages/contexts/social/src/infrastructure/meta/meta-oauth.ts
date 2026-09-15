import { err, ok, type Result } from "@portal-app/shared-kernel";

import type { GraphError, MetaGraphClient } from "./graph-client";

/**
 * Os escopos pedidos no login da Meta (spec 08, §6.3).
 *
 * `business_management` entra além dos cinco de publicação por um motivo
 * prático: quando a Página pertence a um Portfólio Empresarial — o arranjo
 * normal de veículo e de agência —, o `/me/accounts` não a devolve sem ele, e o
 * sintoma é a pessoa fazer o login inteiro e ver a lista de Páginas vazia.
 */
export const META_SCOPES = [
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
	"instagram_basic",
	"instagram_content_publish",
	"business_management",
] as const;

export type MetaOAuthConfig = {
	appId: string;
	appSecret: string;
	version: string;
	/** Precisa bater, caractere por caractere, com o cadastrado no App. */
	redirectUri: string;
};

/** Uma Página que a pessoa administra, com o Instagram vinculado a ela. */
export type MetaPage = {
	id: string;
	name: string;
	/** Token DA PÁGINA. Derivado de um token de usuário longo, não expira. */
	accessToken: string;
	pictureUrl: string | null;
	instagram: {
		id: string;
		username: string;
		pictureUrl: string | null;
	} | null;
};

/**
 * A URL do diálogo de login da Meta.
 *
 * Fluxo de **código** (`response_type=code`), e não o de token no fragmento que
 * a documentação do Instagram mostra: com código, o token nasce no servidor, na
 * troca feita com o segredo do App, e nunca passa pelo navegador.
 *
 * O `state` é a proteção contra CSRF — quem chama guarda o mesmo valor num
 * cookie e confere na volta.
 */
export function buildAuthorizeUrl(
	config: Pick<MetaOAuthConfig, "appId" | "version" | "redirectUri">,
	state: string,
): string {
	const params = new URLSearchParams({
		client_id: config.appId,
		redirect_uri: config.redirectUri,
		state,
		response_type: "code",
		scope: META_SCOPES.join(","),
	});
	return `https://www.facebook.com/${config.version}/dialog/oauth?${params.toString()}`;
}

type TokenResponse = { access_token: string; expires_in?: number };

type AccountsResponse = {
	data: Array<{
		id: string;
		name: string;
		access_token: string;
		picture?: { data?: { url?: string } };
		instagram_business_account?: {
			id: string;
			username?: string;
			profile_picture_url?: string;
		};
	}>;
};

/**
 * As três chamadas do login: código → token curto → token longo → Páginas.
 *
 * Todas usam o segredo do App ou o token do usuário, então **só rodam no
 * servidor**. Nada aqui é importado por componente de cliente.
 */
export class MetaOAuth {
	constructor(
		private readonly config: MetaOAuthConfig,
		private readonly client: MetaGraphClient,
	) {}

	/** Troca o código da volta do login por um token de usuário longo (60 dias). */
	async exchangeCode(code: string): Promise<Result<string, GraphError>> {
		const short = await this.client.get<TokenResponse>("oauth/access_token", {
			client_id: this.config.appId,
			client_secret: this.config.appSecret,
			redirect_uri: this.config.redirectUri,
			code,
		});
		if (short.isErr()) {
			return err(short.unwrapErr());
		}

		// Sem esta segunda troca, o token de Página derivado dele expiraria junto
		// com o token curto — em uma hora. Com ela, o token de Página não expira.
		const long = await this.client.get<TokenResponse>("oauth/access_token", {
			grant_type: "fb_exchange_token",
			client_id: this.config.appId,
			client_secret: this.config.appSecret,
			fb_exchange_token: short.unwrap().access_token,
		});
		if (long.isErr()) {
			return err(long.unwrapErr());
		}
		return ok(long.unwrap().access_token);
	}

	/** As Páginas que a pessoa administra, com o Instagram de cada uma. */
	async listPages(
		userToken: string,
	): Promise<Result<readonly MetaPage[], GraphError>> {
		const result = await this.client.get<AccountsResponse>(
			"me/accounts",
			{
				fields:
					"id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
				limit: 100,
			},
			userToken,
		);
		if (result.isErr()) {
			return err(result.unwrapErr());
		}
		return ok(
			result.unwrap().data.map((page) => ({
				id: page.id,
				name: page.name,
				accessToken: page.access_token,
				pictureUrl: page.picture?.data?.url ?? null,
				instagram: page.instagram_business_account
					? {
							id: page.instagram_business_account.id,
							username:
								page.instagram_business_account.username ??
								page.instagram_business_account.id,
							pictureUrl:
								page.instagram_business_account.profile_picture_url ?? null,
						}
					: null,
			})),
		);
	}
}
