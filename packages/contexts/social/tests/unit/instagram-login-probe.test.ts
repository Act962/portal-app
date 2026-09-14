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

	it("token de outra conta: diz de quem é o token e qual id usar", async () => {
		// O erro mais provável de uma configuração à mão.
		const { urls, probe } = fakeGraph(() =>
			Response.json({ user_id: "999", username: "outra_conta" }),
		);

		const [problem] = (await probe.inspect(credenciais)).problems;

		expect(problem).toContain("@outra_conta");
		expect(problem).toContain("id 999");
		expect(problem).toContain("META_INSTAGRAM_USER_ID é 17841400000000001");
		expect(urls).toHaveLength(1);
	});

	it("token de outra conta sem username na resposta", async () => {
		const { probe } = fakeGraph(() => Response.json({ user_id: "999" }));
		expect((await probe.inspect(credenciais)).problems[0]).toContain("id 999");
	});

	it("token vencido ou inválido (190) manda gerar outro", async () => {
		const { probe } = fakeGraph(() =>
			Response.json(
				{ error: { message: "Invalid OAuth access token", code: 190 } },
				{ status: 400 },
			),
		);
		const [problem] = (await probe.inspect(credenciais)).problems;
		expect(problem).toContain("Gere um novo");
		expect(problem).not.toContain(TOKEN);
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
