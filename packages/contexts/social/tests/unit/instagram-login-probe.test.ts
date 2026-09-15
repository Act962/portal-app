import { MetaGraphClient } from "@portal-app/social/infrastructure/meta/graph-client";
import { InstagramLoginProbe } from "@portal-app/social/infrastructure/meta/instagram-login-probe";
import { describe, expect, it } from "vitest";

const TOKEN = "IGAA-TOKEN";

function fakeGraph(respond: (url: URL) => Response) {
	const urls: URL[] = [];
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		urls.push(url);
		return respond(url);
	}) as typeof fetch;
	return {
		urls,
		probe: new InstagramLoginProbe({
			client: new MetaGraphClient({
				version: "v25.0",
				baseUrl: "https://graph.instagram.test",
				fetch: fetchImpl,
			}),
		}),
	};
}

const credenciais = {
	accountId: "ambiente-instagram",
	platform: "INSTAGRAM" as const,
	accountRemoteId: "17841400000000001",
	accessToken: TOKEN,
};

/** Uma resposta NOVA por chamada: o corpo de um `Response` só pode ser lido
 * uma vez, e compartilhar a mesma instância entre testes a esvazia. */
const cota = () =>
	Response.json({
		data: [{ quota_usage: 2, config: { quota_total: 50 } }],
	});

describe("InstagramLoginProbe", () => {
	it("token da conta certa: sem problema, com a cota", async () => {
		const { urls, probe } = fakeGraph((url) =>
			url.pathname.endsWith("content_publishing_limit")
				? cota()
				: Response.json({ user_id: "17841400000000001", username: "radio" }),
		);

		expect(await probe.inspect(credenciais)).toEqual({
			problems: [],
			quota: { used: 2, total: 50 },
		});
		expect(urls[0]?.pathname).toBe("/v25.0/me");
		expect(urls[0]?.searchParams.get("fields")).toBe("user_id,username");
		expect(urls[0]?.searchParams.get("access_token")).toBe(TOKEN);
		expect(urls[1]?.pathname).toBe(
			"/v25.0/17841400000000001/content_publishing_limit",
		);
	});

	it("user_id que chega como número JSON também confere", async () => {
		const { probe } = fakeGraph((url) =>
			url.pathname.endsWith("content_publishing_limit")
				? cota()
				: Response.json({ user_id: 1784 }),
		);
		expect(
			(await probe.inspect({ ...credenciais, accountRemoteId: "1784" }))
				.problems,
		).toEqual([]);
	});

	it("token de outra conta: diz de quem é, sem ids nem nomes de configuração", async () => {
		// O erro mais provável de uma configuração à mão. A mensagem aparece no
		// painel: nada de variável do servidor nem id de conta.
		const { urls, probe } = fakeGraph(() =>
			Response.json({ user_id: "999", username: "outra_conta" }),
		);

		const [problem] = (await probe.inspect(credenciais)).problems;

		expect(problem).toContain("@outra_conta");
		expect(problem).toContain("outra conta do Instagram");
		expect(problem).not.toMatch(/META_|999|17841400000000001/);
		expect(urls).toHaveLength(1);
	});

	it("token de outra conta sem username na resposta", async () => {
		const { probe } = fakeGraph(() => Response.json({ user_id: "999" }));
		expect((await probe.inspect(credenciais)).problems[0]).toBe(
			"A autorização é de outra conta do Instagram. Peça ao administrador do sistema para revisar a configuração.",
		);
	});

	it("token vencido ou inválido (190) pede a renovação, sem expor a configuração", async () => {
		const { probe } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Invalid OAuth access token", code: 190 } },
				{ status: 400 },
			),
		);
		const [problem] = (await probe.inspect(credenciais)).problems;
		expect(problem).toContain("renová-la");
		expect(problem).not.toContain(TOKEN);
		expect(problem).not.toMatch(/META_|\.env/);
	});

	it("Instagram fora do ar vira problema legível", async () => {
		const { probe } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Unavailable", code: 2 } },
				{ status: 503 },
			),
		);
		expect((await probe.inspect(credenciais)).problems[0]).toContain(
			"Não foi possível consultar o Instagram",
		);
	});
});
