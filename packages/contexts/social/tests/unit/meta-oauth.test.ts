import { MetaGraphClient } from "@portal-app/social/infrastructure/meta/graph-client";
import {
	buildAuthorizeUrl,
	META_SCOPES,
	MetaOAuth,
} from "@portal-app/social/infrastructure/meta/meta-oauth";
import { describe, expect, it } from "vitest";

const CONFIG = {
	appId: "123456",
	appSecret: "segredo-do-app",
	version: "v25.0",
	redirectUri: "https://fm7cidades.com/api/social/meta/callback",
};

describe("buildAuthorizeUrl", () => {
	const url = new URL(buildAuthorizeUrl(CONFIG, "estado-aleatorio"));

	it("aponta para o diálogo da versão configurada", () => {
		expect(url.origin).toBe("https://www.facebook.com");
		expect(url.pathname).toBe("/v25.0/dialog/oauth");
	});

	it("usa o fluxo de CÓDIGO — o token nasce no servidor, não no navegador", () => {
		expect(url.searchParams.get("response_type")).toBe("code");
	});

	it("leva o state, o App e o endereço de volta exatos", () => {
		expect(url.searchParams.get("state")).toBe("estado-aleatorio");
		expect(url.searchParams.get("client_id")).toBe("123456");
		expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
	});

	it("pede os escopos de publicação E o business_management", () => {
		// Sem business_management, Página de Portfólio Empresarial não aparece.
		const scopes = url.searchParams.get("scope")?.split(",") ?? [];
		expect(scopes).toEqual([...META_SCOPES]);
		expect(scopes).toContain("instagram_content_publish");
		expect(scopes).toContain("pages_manage_posts");
		expect(scopes).toContain("business_management");
	});

	it("NUNCA leva o segredo do App", () => {
		expect(url.toString()).not.toContain("segredo-do-app");
	});
});

function fakeGraph(respond: (url: URL) => Response) {
	const urls: URL[] = [];
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		urls.push(url);
		return respond(url);
	}) as typeof fetch;
	return {
		urls,
		oauth: new MetaOAuth(
			CONFIG,
			new MetaGraphClient({
				version: "v25.0",
				baseUrl: "https://graph.test",
				fetch: fetchImpl,
			}),
		),
	};
}

describe("MetaOAuth.exchangeCode", () => {
	it("troca o código e depois troca o token curto pelo longo", async () => {
		const { urls, oauth } = fakeGraph((url) =>
			url.searchParams.get("grant_type") === "fb_exchange_token"
				? Response.json({ access_token: "LONGO", expires_in: 5184000 })
				: Response.json({ access_token: "CURTO" }),
		);

		expect((await oauth.exchangeCode("codigo-123")).unwrap()).toBe("LONGO");

		expect(urls).toHaveLength(2);
		expect(urls[0]?.searchParams.get("code")).toBe("codigo-123");
		expect(urls[0]?.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
		expect(urls[1]?.searchParams.get("fb_exchange_token")).toBe("CURTO");
	});

	it("erro na primeira troca não tenta a segunda", async () => {
		const { urls, oauth } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Code expired", code: 100 } },
				{ status: 400 },
			),
		);
		expect((await oauth.exchangeCode("velho")).unwrapErr().message).toBe(
			"Code expired",
		);
		expect(urls).toHaveLength(1);
	});

	it("erro na segunda troca é devolvido", async () => {
		const { oauth } = fakeGraph((url) =>
			url.searchParams.get("grant_type")
				? Response.json(
						{ error: { message: "nope", code: 1 } },
						{ status: 500 },
					)
				: Response.json({ access_token: "CURTO" }),
		);
		expect((await oauth.exchangeCode("c")).isErr()).toBe(true);
	});
});

describe("MetaOAuth.listPages", () => {
	it("traz cada Página com o token dela e o Instagram vinculado", async () => {
		const { urls, oauth } = fakeGraph(() =>
			Response.json({
				data: [
					{
						id: "page-1",
						name: "Rádio 7 Cidades",
						access_token: "TOKEN-PAGINA-1",
						picture: { data: { url: "https://cdn/p1.jpg" } },
						instagram_business_account: {
							id: "ig-1",
							username: "radio7cidades",
							profile_picture_url: "https://cdn/ig1.jpg",
						},
					},
					{
						id: "page-2",
						name: "Página pessoal",
						access_token: "TOKEN-PAGINA-2",
					},
				],
			}),
		);

		const pages = (await oauth.listPages("TOKEN-USUARIO")).unwrap();

		expect(pages).toEqual([
			{
				id: "page-1",
				name: "Rádio 7 Cidades",
				accessToken: "TOKEN-PAGINA-1",
				pictureUrl: "https://cdn/p1.jpg",
				instagram: {
					id: "ig-1",
					username: "radio7cidades",
					pictureUrl: "https://cdn/ig1.jpg",
				},
			},
			{
				id: "page-2",
				name: "Página pessoal",
				accessToken: "TOKEN-PAGINA-2",
				pictureUrl: null,
				instagram: null,
			},
		]);
		expect(urls[0]?.pathname).toBe("/v25.0/me/accounts");
		expect(urls[0]?.searchParams.get("fields")).toContain(
			"instagram_business_account",
		);
		expect(urls[0]?.searchParams.get("access_token")).toBe("TOKEN-USUARIO");
	});

	it("Instagram sem username usa o id, em vez de mostrar @undefined", async () => {
		const { oauth } = fakeGraph(() =>
			Response.json({
				data: [
					{
						id: "p",
						name: "P",
						access_token: "T",
						instagram_business_account: { id: "ig-9" },
					},
				],
			}),
		);
		const [page] = (await oauth.listPages("T")).unwrap();
		expect(page?.instagram).toEqual({
			id: "ig-9",
			username: "ig-9",
			pictureUrl: null,
		});
	});

	it("devolve o erro da Meta", async () => {
		const { oauth } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Invalid token", code: 190 } },
				{ status: 400 },
			),
		);
		expect((await oauth.listPages("T")).unwrapErr().code).toBe(190);
	});
});
