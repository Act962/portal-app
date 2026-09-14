import type { SocialPlatform } from "@portal-app/social";
import { MetaGraphClient } from "@portal-app/social/infrastructure/meta/graph-client";
import {
	MetaConnectionProbe,
	REQUIRED_SCOPES,
} from "@portal-app/social/infrastructure/meta/meta-connection-probe";
import { describe, expect, it } from "vitest";

const TOKEN = "TOKEN-DA-PAGINA";

function fakeGraph(respond: (url: URL) => Response) {
	const urls: URL[] = [];
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		urls.push(url);
		return respond(url);
	}) as typeof fetch;
	return {
		urls,
		probe: new MetaConnectionProbe({
			client: new MetaGraphClient({
				version: "v25.0",
				baseUrl: "https://graph.test",
				fetch: fetchImpl,
			}),
			appId: "123",
			appSecret: "segredo",
		}),
	};
}

const credenciais = (platform: SocialPlatform) => ({
	accountId: `acc-${platform}`,
	platform,
	accountRemoteId: platform === "INSTAGRAM" ? "ig-1" : "page-1",
	accessToken: TOKEN,
});

const todasAsPermissoes = [
	...REQUIRED_SCOPES.INSTAGRAM,
	...REQUIRED_SCOPES.FACEBOOK,
];

describe("MetaConnectionProbe", () => {
	it("token válido com todas as permissões: nenhum problema", async () => {
		const { urls, probe } = fakeGraph(() =>
			Response.json({ data: { is_valid: true, scopes: todasAsPermissoes } }),
		);

		const inspection = await probe.inspect(credenciais("FACEBOOK"));

		expect(inspection).toEqual({ problems: [], quota: null });
		expect(urls).toHaveLength(1);
		expect(urls[0]?.pathname).toBe("/v25.0/debug_token");
		expect(urls[0]?.searchParams.get("input_token")).toBe(TOKEN);
		// O debug_token pede o token do APP, e não o da Página.
		expect(urls[0]?.searchParams.get("access_token")).toBe("123|segredo");
	});

	it("token revogado pede reconexão e nem consulta a cota", async () => {
		const { urls, probe } = fakeGraph(() =>
			Response.json({ data: { is_valid: false } }),
		);

		const inspection = await probe.inspect(credenciais("INSTAGRAM"));

		expect(inspection.problems[0]).toContain("Reconecte");
		expect(urls).toHaveLength(1);
	});

	it("resposta sem `data` é tratada como token inválido", async () => {
		const { probe } = fakeGraph(() => Response.json({}));
		expect(
			(await probe.inspect(credenciais("FACEBOOK"))).problems,
		).toHaveLength(1);
	});

	it("lista as permissões que faltaram no login", async () => {
		// O caso real: a pessoa desmarca "publicar" na tela de permissões da Meta,
		// e a conexão parece ter dado certo até o primeiro post.
		const { probe } = fakeGraph(() =>
			Response.json({
				data: { is_valid: true, scopes: ["pages_show_list"] },
			}),
		);

		const [problem] = (await probe.inspect(credenciais("FACEBOOK"))).problems;

		expect(problem).toContain("pages_manage_posts");
		expect(problem).toContain("pages_read_engagement");
		expect(problem).not.toContain("pages_show_list");
	});

	it("resposta sem scopes lista todas as permissões da rede", async () => {
		const { probe } = fakeGraph(() =>
			Response.json({ data: { is_valid: true } }),
		);
		const [problem] = (await probe.inspect(credenciais("INSTAGRAM"))).problems;
		expect(problem).toContain("instagram_content_publish");
	});

	it("no Instagram, traz a cota do dia", async () => {
		const { urls, probe } = fakeGraph((url) =>
			url.pathname.endsWith("content_publishing_limit")
				? Response.json({
						data: [
							{
								quota_usage: 12,
								config: { quota_total: 50, quota_duration: 86400 },
							},
						],
					})
				: Response.json({
						data: { is_valid: true, scopes: todasAsPermissoes },
					}),
		);

		const inspection = await probe.inspect(credenciais("INSTAGRAM"));

		expect(inspection).toEqual({
			problems: [],
			quota: { used: 12, total: 50 },
		});
		expect(urls[1]?.pathname).toBe("/v25.0/ig-1/content_publishing_limit");
		expect(urls[1]?.searchParams.get("access_token")).toBe(TOKEN);
	});

	it("cota que não responde vira `null`, não problema", async () => {
		const { probe } = fakeGraph((url) =>
			url.pathname.endsWith("content_publishing_limit")
				? Response.json({ error: { message: "x", code: 1 } }, { status: 500 })
				: Response.json({
						data: { is_valid: true, scopes: todasAsPermissoes },
					}),
		);
		expect(await probe.inspect(credenciais("INSTAGRAM"))).toEqual({
			problems: [],
			quota: null,
		});
	});

	it("Meta fora do ar vira problema legível, sem o segredo do App", async () => {
		const { probe } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Service unavailable", code: 2 } },
				{ status: 503 },
			),
		);

		const [problem] = (await probe.inspect(credenciais("FACEBOOK"))).problems;

		expect(problem).toContain("Não foi possível consultar a Meta");
		expect(problem).not.toContain("segredo");
		expect(problem).not.toContain(TOKEN);
	});
});
