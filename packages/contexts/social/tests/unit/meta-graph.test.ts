import {
	type GraphError,
	MetaGraphClient,
} from "@portal-app/social/infrastructure/meta/graph-client";
import { toPublishFailure } from "@portal-app/social/infrastructure/meta/graph-errors";
import { describe, expect, it } from "vitest";

function graphError(overrides: Partial<GraphError>): GraphError {
	return {
		status: 400,
		code: null,
		subcode: null,
		message: "Mensagem da Meta",
		userMessage: null,
		isTransient: false,
		...overrides,
	};
}

describe("toPublishFailure — o que a redação lê e se vale repetir", () => {
	it.each([
		{ code: 190, retryable: false, contains: "Reconecte" },
		{ code: 10, retryable: false, contains: "permissão" },
		{ code: 200, retryable: false, contains: "permissão" },
		{ code: 4, retryable: true, contains: "pausa" },
		{ code: 17, retryable: true, contains: "pausa" },
		{ code: 32, retryable: true, contains: "pausa" },
		{ code: 613, retryable: true, contains: "pausa" },
		{ code: 1, retryable: true, contains: "instável" },
		{ code: 2, retryable: true, contains: "instável" },
		{ code: 9004, retryable: false, contains: "baixar a imagem" },
		{ code: 36000, retryable: false, contains: "grande demais" },
	])(
		"código $code → repetível: $retryable",
		({ code, retryable, contains }) => {
			const failure = toPublishFailure(graphError({ code }), "INSTAGRAM");
			expect(failure.retryable).toBe(retryable);
			expect(failure.reason).toContain(contains);
			expect(failure.reason).toContain("Instagram");
		},
	);

	it("token revogado NÃO é repetível — repetir não traz a autorização de volta", () => {
		expect(
			toPublishFailure(graphError({ code: 190 }), "FACEBOOK").retryable,
		).toBe(false);
	});

	it("falha de rede (status 0) é repetível", () => {
		const failure = toPublishFailure(
			graphError({ status: 0, isTransient: true }),
			"FACEBOOK",
		);
		expect(failure.retryable).toBe(true);
		expect(failure.providerCode).toBe("HTTP_0");
	});

	it("código desconhecido marcado como transitório é repetível", () => {
		expect(
			toPublishFailure(
				graphError({ code: 99999, isTransient: true }),
				"FACEBOOK",
			).retryable,
		).toBe(true);
	});

	it("5xx sem código é repetível", () => {
		expect(
			toPublishFailure(graphError({ status: 503 }), "FACEBOOK").retryable,
		).toBe(true);
	});

	it("desconhecido e definitivo preserva a frase da Meta em vez de inventar", () => {
		const failure = toPublishFailure(
			graphError({
				code: 12345,
				subcode: 678,
				userMessage: "Legenda contém link bloqueado.",
			}),
			"INSTAGRAM",
		);
		expect(failure.retryable).toBe(false);
		expect(failure.reason).toContain("Legenda contém link bloqueado.");
		expect(failure.providerCode).toBe("12345/678");
	});

	it("sem frase de usuário, usa a mensagem técnica", () => {
		expect(
			toPublishFailure(graphError({ code: 12345 }), "INSTAGRAM").reason,
		).toContain("Mensagem da Meta");
	});
});

describe("MetaGraphClient", () => {
	function client(
		respond: (url: URL, init: RequestInit | undefined) => Response,
	) {
		const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
		const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input));
			calls.push({ url, init });
			return respond(url, init);
		}) as typeof fetch;
		return {
			calls,
			graph: new MetaGraphClient({
				version: "v25.0",
				baseUrl: "https://graph.test/",
				fetch: fetchImpl,
			}),
		};
	}

	it("GET monta versão, caminho e token na querystring", async () => {
		const { calls, graph } = client(() => Response.json({ id: "1" }));
		const result = await graph.get("/me/accounts", { limit: 10 }, "TOKEN");
		expect(result.unwrap()).toEqual({ id: "1" });
		expect(calls[0]?.url.pathname).toBe("/v25.0/me/accounts");
		expect(calls[0]?.url.searchParams.get("limit")).toBe("10");
		expect(calls[0]?.url.searchParams.get("access_token")).toBe("TOKEN");
	});

	it("GET sem token não manda access_token", async () => {
		const { calls, graph } = client(() => Response.json({}));
		await graph.get("oauth/access_token", { code: "abc" });
		expect(calls[0]?.url.searchParams.has("access_token")).toBe(false);
	});

	it("POST manda formulário no corpo, com o token", async () => {
		const { calls, graph } = client(() => Response.json({ id: "c1" }));
		await graph.post(
			"ig/media",
			{ caption: "Olá", is_carousel_item: true },
			"T",
		);
		const body = new URLSearchParams(String(calls[0]?.init?.body));
		expect(calls[0]?.init?.method).toBe("POST");
		expect(body.get("caption")).toBe("Olá");
		expect(body.get("is_carousel_item")).toBe("true");
		expect(body.get("access_token")).toBe("T");
	});

	it("extrai o erro da Meta com código, subcódigo e frase de usuário", async () => {
		const { graph } = client(() =>
			Response.json(
				{
					error: {
						message: "Invalid token",
						code: 190,
						error_subcode: 463,
						error_user_msg: "Sessão expirada",
						is_transient: false,
					},
				},
				{ status: 400 },
			),
		);
		const error = (await graph.get("me", {}, "T")).unwrapErr();
		expect(error).toEqual({
			status: 400,
			code: 190,
			subcode: 463,
			message: "Invalid token",
			userMessage: "Sessão expirada",
			isTransient: false,
		});
	});

	it("5xx sem corpo vira erro transitório", async () => {
		const { graph } = client(() => new Response("oops", { status: 502 }));
		const error = (await graph.get("me", {}, "T")).unwrapErr();
		expect(error.status).toBe(502);
		expect(error.isTransient).toBe(true);
		expect(error.message).toBe("HTTP 502");
	});

	it("falha de rede vira status 0, transitório", async () => {
		const fetchImpl = (async () => {
			throw new TypeError("fetch failed");
		}) as typeof fetch;
		const graph = new MetaGraphClient({ version: "v25.0", fetch: fetchImpl });
		const error = (await graph.get("me", {}, "T")).unwrapErr();
		expect(error.status).toBe(0);
		expect(error.isTransient).toBe(true);
		expect(error.message).toBe("fetch failed");
	});

	it("rejeição que não é Error ainda vira mensagem legível", async () => {
		const fetchImpl = (async () => {
			throw "boom";
		}) as typeof fetch;
		const graph = new MetaGraphClient({ version: "v25.0", fetch: fetchImpl });
		expect((await graph.get("me", {})).unwrapErr().message).toBe(
			"Falha de rede.",
		);
	});
});
