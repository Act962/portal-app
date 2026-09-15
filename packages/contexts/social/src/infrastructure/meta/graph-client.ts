import { err, ok, type Result } from "@portal-app/shared-kernel";

/**
 * Um erro da Graph API, já extraído do JSON.
 *
 * `status` 0 é convenção nossa para "nem chegou a responder" — DNS, timeout,
 * conexão recusada. É transitório por definição, e separá-lo aqui evita que o
 * classificador precise saber o que é um `TypeError: fetch failed`.
 */
export type GraphError = {
	status: number;
	code: number | null;
	subcode: number | null;
	message: string;
	/** A frase que a Meta escreveu para mostrar a um usuário, quando existe. */
	userMessage: string | null;
	isTransient: boolean;
};

export type GraphParams = Record<string, string | number | boolean>;

export type GraphClientConfig = {
	/** `v25.0`. Fixada por configuração: a Meta desativa versões antigas em
	 * calendário, e trocar a versão tem de ser uma decisão, não um acidente. */
	version: string;
	/** Injetado para o teste passar um dublê sem rede. */
	fetch?: typeof fetch;
	/** Base da API — só o teste troca. */
	baseUrl?: string;
};

/**
 * Cliente mínimo da Graph API da Meta.
 *
 * **Sem SDK, de propósito.** A superfície que este módulo usa são sete
 * endpoints com parâmetros de formulário; um SDK traria centenas de outros,
 * tipos gerados que envelhecem a cada versão da API, e mais uma dependência a
 * atualizar. `fetch` já está no runtime.
 *
 * O token vai no corpo/querystring como `access_token`, que é a forma
 * documentada. Ele NUNCA entra em mensagem de erro: o erro devolvido aqui é o
 * que a Meta respondeu, e a Meta não ecoa o token.
 */
export class MetaGraphClient {
	private readonly fetchImpl: typeof fetch;
	private readonly base: string;

	constructor(private readonly config: GraphClientConfig) {
		this.fetchImpl = config.fetch ?? fetch;
		this.base = (config.baseUrl ?? "https://graph.facebook.com").replace(
			/\/+$/,
			"",
		);
	}

	get<T>(
		path: string,
		params: GraphParams,
		accessToken?: string,
	): Promise<Result<T, GraphError>> {
		const query = toSearchParams({
			...params,
			...(accessToken ? { access_token: accessToken } : {}),
		});
		return this.send<T>(`${this.url(path)}?${query}`, { method: "GET" });
	}

	post<T>(
		path: string,
		params: GraphParams,
		accessToken: string,
	): Promise<Result<T, GraphError>> {
		return this.send<T>(this.url(path), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: toSearchParams({ ...params, access_token: accessToken }),
		});
	}

	private url(path: string): string {
		return `${this.base}/${this.config.version}/${path.replace(/^\/+/, "")}`;
	}

	private async send<T>(
		url: string,
		init: RequestInit,
	): Promise<Result<T, GraphError>> {
		let response: Response;
		try {
			response = await this.fetchImpl(url, init);
		} catch (cause) {
			return err({
				status: 0,
				code: null,
				subcode: null,
				message: cause instanceof Error ? cause.message : "Falha de rede.",
				userMessage: null,
				isTransient: true,
			});
		}

		const body = (await response.json().catch(() => null)) as {
			error?: {
				message?: string;
				code?: number;
				error_subcode?: number;
				error_user_msg?: string;
				is_transient?: boolean;
			};
		} | null;

		if (!response.ok || body?.error) {
			const error = body?.error;
			return err({
				status: response.status,
				code: error?.code ?? null,
				subcode: error?.error_subcode ?? null,
				message: error?.message ?? `HTTP ${response.status}`,
				userMessage: error?.error_user_msg ?? null,
				isTransient: error?.is_transient ?? response.status >= 500,
			});
		}

		return ok(body as T);
	}
}

function toSearchParams(params: GraphParams): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		search.set(key, String(value));
	}
	return search.toString();
}
