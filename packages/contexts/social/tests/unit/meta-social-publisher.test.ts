import type { SocialPlatform } from "@portal-app/social";
import { MetaGraphClient } from "@portal-app/social/infrastructure/meta/graph-client";
import { MetaSocialPublisher } from "@portal-app/social/infrastructure/meta/meta-social-publisher";
import { describe, expect, it, vi } from "vitest";

const TOKEN = "TOKEN-DA-PAGINA-SECRETO";

type Call = { method: string; path: string; params: URLSearchParams };
type Reply = { status?: number; body: unknown };

/**
 * Uma Graph API de mentira, dirigida por uma função: recebe a chamada e decide
 * a resposta. Registra tudo, para o teste afirmar a SEQUÊNCIA — que é onde o
 * adapter da Meta erra (publicar antes de o container terminar, esquecer o
 * `is_carousel_item`, publicar N fotos soltas em vez de um álbum).
 */
function fakeGraph(handler: (call: Call) => Reply) {
	const calls: Call[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const params =
			method === "GET"
				? url.searchParams
				: new URLSearchParams(String(init?.body ?? ""));
		const call = { method, path: url.pathname.replace("/v25.0/", ""), params };
		calls.push(call);
		const reply = handler(call);
		return Response.json(reply.body, { status: reply.status ?? 200 });
	}) as typeof fetch;
	return {
		calls,
		client: new MetaGraphClient({
			version: "v25.0",
			baseUrl: "https://graph.test",
			fetch: fetchImpl,
		}),
	};
}

function publisher(
	client: MetaGraphClient,
	overrides: Partial<ConstructorParameters<typeof MetaSocialPublisher>[0]> = {},
) {
	return new MetaSocialPublisher({
		client,
		credentialsFor: async (platform: SocialPlatform) => ({
			accountId: `acc-${platform}`,
			platform,
			accountRemoteId: "ignorado",
			accessToken: TOKEN,
		}),
		sleep: async () => {},
		pollAttempts: 3,
		pollIntervalMs: 1,
		// Os roteiros abaixo afirmam a sequência exata de chamadas; a consulta de
		// cota tem testes próprios, no fim do arquivo.
		checkQuota: false,
		...overrides,
	});
}

const imagem = (id: string) => ({
	url: `https://cdn.test/${id}.jpg`,
	altText: `alt ${id}`,
});

const request = (
	platform: SocialPlatform,
	images = [imagem("m1")],
	caption = "Chuva alaga o centro",
) => ({
	platform,
	format: "FEED" as const,
	accountRemoteId: platform === "INSTAGRAM" ? "ig-1" : "page-1",
	caption,
	images,
	linkUrl: null,
});

describe("MetaSocialPublisher — Instagram", () => {
	it("foto: cria o container, espera terminar, publica e busca o link", async () => {
		const { calls, client } = fakeGraph((call) => {
			if (call.method === "POST" && call.path === "ig-1/media") {
				return { body: { id: "c1" } };
			}
			if (call.path === "c1") {
				return { body: { status_code: "FINISHED" } };
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "m1" } };
			}
			return { body: { permalink: "https://instagram.com/p/abc" } };
		});

		const result = await publisher(client).publish(request("INSTAGRAM"));

		expect(result.unwrap()).toEqual({
			remoteId: "m1",
			permalink: "https://instagram.com/p/abc",
		});
		expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
			"POST ig-1/media",
			"GET c1",
			"POST ig-1/media_publish",
			"GET m1",
		]);
		expect(calls[0]?.params.get("image_url")).toBe("https://cdn.test/m1.jpg");
		expect(calls[0]?.params.get("caption")).toBe("Chuva alaga o centro");
		expect(calls[0]?.params.get("access_token")).toBe(TOKEN);
		expect(calls[2]?.params.get("creation_id")).toBe("c1");
	});

	it("espera o processamento: só publica depois de FINISHED", async () => {
		let polls = 0;
		const sleep = vi.fn(async () => {});
		const { calls, client } = fakeGraph((call) => {
			if (call.path === "ig-1/media") {
				return { body: { id: "c1" } };
			}
			if (call.path === "c1") {
				polls += 1;
				return {
					body: { status_code: polls < 3 ? "IN_PROGRESS" : "FINISHED" },
				};
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "m1" } };
			}
			return { body: {} };
		});

		const result = await publisher(client, { sleep }).publish(
			request("INSTAGRAM"),
		);

		expect(result.isOk()).toBe(true);
		expect(sleep).toHaveBeenCalledTimes(2);
		const publishIndex = calls.findIndex(
			(c) => c.path === "ig-1/media_publish",
		);
		expect(publishIndex).toBeGreaterThan(
			calls.findLastIndex((c) => c.path === "c1"),
		);
	});

	it("carrossel: um container por imagem, marcado como item, e a legenda só no carrossel", async () => {
		let child = 0;
		const { calls, client } = fakeGraph((call) => {
			if (call.method === "POST" && call.path === "ig-1/media") {
				if (call.params.get("media_type") === "CAROUSEL") {
					return { body: { id: "carrossel" } };
				}
				child += 1;
				return { body: { id: `filho-${child}` } };
			}
			if (
				call.method === "GET" &&
				call.params.get("fields") === "status_code"
			) {
				return { body: { status_code: "FINISHED" } };
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "m9" } };
			}
			return { body: { permalink: null } };
		});

		const result = await publisher(client).publish(
			request("INSTAGRAM", [imagem("a"), imagem("b"), imagem("c")]),
		);

		expect(result.unwrap().remoteId).toBe("m9");
		const creates = calls.filter(
			(c) => c.method === "POST" && c.path === "ig-1/media",
		);
		expect(creates).toHaveLength(4);
		for (const item of creates.slice(0, 3)) {
			expect(item.params.get("is_carousel_item")).toBe("true");
			expect(item.params.has("caption")).toBe(false);
		}
		const carousel = creates[3];
		expect(carousel?.params.get("children")).toBe("filho-1,filho-2,filho-3");
		expect(carousel?.params.get("caption")).toBe("Chuva alaga o centro");
		// A ordem dos filhos é a ordem das imagens — a primeira é a capa.
		expect(creates.slice(0, 3).map((c) => c.params.get("image_url"))).toEqual([
			"https://cdn.test/a.jpg",
			"https://cdn.test/b.jpg",
			"https://cdn.test/c.jpg",
		]);
		expect(
			calls
				.find((c) => c.path === "ig-1/media_publish")
				?.params.get("creation_id"),
		).toBe("carrossel");
	});

	it("container com ERROR não publica e não é repetível", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.path === "ig-1/media"
				? { body: { id: "c1" } }
				: { body: { status_code: "ERROR" } },
		);

		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();

		expect(failure.retryable).toBe(false);
		expect(failure.providerCode).toBe("CONTAINER_ERROR");
		expect(calls.some((c) => c.path === "ig-1/media_publish")).toBe(false);
	});

	it("container EXPIRED é repetível", async () => {
		const { client } = fakeGraph((call) =>
			call.path === "ig-1/media"
				? { body: { id: "c1" } }
				: { body: { status_code: "EXPIRED" } },
		);
		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();
		expect(failure.retryable).toBe(true);
		expect(failure.providerCode).toBe("CONTAINER_EXPIRED");
	});

	it("processamento que não termina a tempo é repetível, sem publicar", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.path === "ig-1/media"
				? { body: { id: "c1" } }
				: { body: { status_code: "IN_PROGRESS" } },
		);

		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();

		expect(failure.retryable).toBe(true);
		expect(failure.providerCode).toBe("CONTAINER_TIMEOUT");
		expect(calls.filter((c) => c.path === "c1")).toHaveLength(3);
		expect(calls.some((c) => c.path === "ig-1/media_publish")).toBe(false);
	});

	it("falha ao criar filho do carrossel interrompe tudo", async () => {
		const { calls, client } = fakeGraph(() => ({
			status: 400,
			body: { error: { message: "bad image", code: 9004 } },
		}));
		const failure = (
			await publisher(client).publish(
				request("INSTAGRAM", [imagem("a"), imagem("b")]),
			)
		).unwrapErr();
		expect(failure.reason).toContain("baixar a imagem");
		expect(calls).toHaveLength(1);
	});

	it("erro ao consultar o status é traduzido", async () => {
		const { client } = fakeGraph((call) =>
			call.path === "ig-1/media"
				? { body: { id: "c1" } }
				: { status: 400, body: { error: { message: "x", code: 190 } } },
		);
		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();
		expect(failure.reason).toContain("Reconecte");
	});

	it("erro no media_publish é traduzido", async () => {
		const { client } = fakeGraph((call) => {
			if (call.path === "ig-1/media") {
				return { body: { id: "c1" } };
			}
			if (call.path === "c1") {
				return { body: { status_code: "FINISHED" } };
			}
			return { status: 400, body: { error: { message: "limite", code: 4 } } };
		});
		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();
		expect(failure.retryable).toBe(true);
	});

	it("erro no container do carrossel é traduzido", async () => {
		const { client } = fakeGraph((call) => {
			if (call.params.get("media_type") === "CAROUSEL") {
				return { status: 400, body: { error: { message: "x", code: 10 } } };
			}
			if (call.method === "POST") {
				return { body: { id: "filho" } };
			}
			return { body: { status_code: "FINISHED" } };
		});
		const failure = (
			await publisher(client).publish(
				request("INSTAGRAM", [imagem("a"), imagem("b")]),
			)
		).unwrapErr();
		expect(failure.reason).toContain("permissão");
	});

	it("filho do carrossel que não processa interrompe antes do carrossel", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "filho" } }
				: { body: { status_code: "ERROR" } },
		);
		const failure = (
			await publisher(client).publish(
				request("INSTAGRAM", [imagem("a"), imagem("b")]),
			)
		).unwrapErr();
		expect(failure.providerCode).toBe("CONTAINER_ERROR");
		expect(calls.some((c) => c.params.get("media_type") === "CAROUSEL")).toBe(
			false,
		);
	});
});

describe("MetaSocialPublisher — Facebook", () => {
	it("foto: publica na Página com legenda e alt, e devolve o POST, não a foto", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "foto-1", post_id: "page-1_99" } }
				: { body: { permalink_url: "https://facebook.com/page-1/posts/99" } },
		);

		const result = await publisher(client).publish(request("FACEBOOK"));

		expect(result.unwrap()).toEqual({
			remoteId: "page-1_99",
			permalink: "https://facebook.com/page-1/posts/99",
		});
		expect(calls[0]?.path).toBe("page-1/photos");
		expect(calls[0]?.params.get("url")).toBe("https://cdn.test/m1.jpg");
		expect(calls[0]?.params.get("caption")).toBe("Chuva alaga o centro");
		expect(calls[0]?.params.get("alt_text_custom")).toBe("alt m1");
		expect(calls[1]?.path).toBe("page-1_99");
		expect(calls[1]?.params.get("fields")).toBe("permalink_url");
	});

	it("foto sem post_id na resposta usa o id da foto", async () => {
		const { client } = fakeGraph((call) =>
			call.method === "POST" ? { body: { id: "foto-1" } } : { body: {} },
		);
		const result = await publisher(client).publish(request("FACEBOOK"));
		expect(result.unwrap()).toEqual({ remoteId: "foto-1", permalink: null });
	});

	it("várias fotos: sobe sem publicar e junta num post só", async () => {
		let photo = 0;
		const { calls, client } = fakeGraph((call) => {
			if (call.path === "page-1/photos") {
				photo += 1;
				return { body: { id: `p${photo}` } };
			}
			if (call.path === "page-1/feed") {
				return { body: { id: "page-1_500" } };
			}
			return { body: { permalink_url: "https://facebook.com/x" } };
		});

		const result = await publisher(client).publish(
			request("FACEBOOK", [
				imagem("a"),
				{ url: "https://cdn.test/b.jpg", altText: "" },
			]),
		);

		expect(result.unwrap().remoteId).toBe("page-1_500");
		const uploads = calls.filter((c) => c.path === "page-1/photos");
		expect(uploads).toHaveLength(2);
		for (const upload of uploads) {
			// Publicar cada foto criaria N posts soltos na Página.
			expect(upload.params.get("published")).toBe("false");
			expect(upload.params.has("caption")).toBe(false);
		}
		// Sem alt, o campo nem vai — mandar vazio apagaria o alt automático da Meta.
		expect(uploads[1]?.params.has("alt_text_custom")).toBe(false);
		const feed = calls.find((c) => c.path === "page-1/feed");
		expect(feed?.params.get("message")).toBe("Chuva alaga o centro");
		expect(feed?.params.get("attached_media[0]")).toBe('{"media_fbid":"p1"}');
		expect(feed?.params.get("attached_media[1]")).toBe('{"media_fbid":"p2"}');
	});

	it("erro ao subir uma das fotos interrompe antes do post", async () => {
		const { calls, client } = fakeGraph(() => ({
			status: 400,
			body: { error: { message: "x", code: 36000 } },
		}));
		const failure = (
			await publisher(client).publish(
				request("FACEBOOK", [imagem("a"), imagem("b")]),
			)
		).unwrapErr();
		expect(failure.reason).toContain("grande demais");
		expect(calls.some((c) => c.path === "page-1/feed")).toBe(false);
	});

	it("erro no post do álbum é traduzido", async () => {
		const { client } = fakeGraph((call) =>
			call.path === "page-1/photos"
				? { body: { id: "p" } }
				: { status: 500, body: { error: { message: "x", code: 2 } } },
		);
		const failure = (
			await publisher(client).publish(
				request("FACEBOOK", [imagem("a"), imagem("b")]),
			)
		).unwrapErr();
		expect(failure.retryable).toBe(true);
	});

	it("erro na foto única é traduzido", async () => {
		const { client } = fakeGraph(() => ({
			status: 400,
			body: { error: { message: "x", code: 190 } },
		}));
		const failure = (
			await publisher(client).publish(request("FACEBOOK"))
		).unwrapErr();
		expect(failure.retryable).toBe(false);
	});
});

describe("MetaSocialPublisher — guardas", () => {
	it("falha ao buscar o link NÃO falha a publicação — o post já está no ar", async () => {
		// Transformar "sem link" em erro faria o worker reenviar e duplicar o post.
		const { client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "f", post_id: "page-1_1" } }
				: { status: 500, body: { error: { message: "x", code: 1 } } },
		);
		const result = await publisher(client).publish(request("FACEBOOK"));
		expect(result.unwrap()).toEqual({ remoteId: "page-1_1", permalink: null });
	});

	it("sem conta conectada, nem chama a Meta", async () => {
		const { calls, client } = fakeGraph(() => ({ body: {} }));
		const failure = (
			await publisher(client, { credentialsFor: async () => null }).publish(
				request("INSTAGRAM"),
			)
		).unwrapErr();
		expect(failure.reason).toContain("Nenhuma conta do Instagram");
		expect(calls).toHaveLength(0);
	});

	it("sem imagem, nem chama a Meta", async () => {
		const { calls, client } = fakeGraph(() => ({ body: {} }));
		const failure = (
			await publisher(client).publish(request("FACEBOOK", []))
		).unwrapErr();
		expect(failure.retryable).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("o token nunca aparece na mensagem de erro", async () => {
		const { client } = fakeGraph(() => ({
			status: 400,
			body: { error: { message: "Erro qualquer", code: 12345 } },
		}));
		const failure = (
			await publisher(client).publish(request("INSTAGRAM"))
		).unwrapErr();
		expect(failure.reason).not.toContain(TOKEN);
	});

	it("usa a espera real quando nenhuma é injetada", async () => {
		vi.useFakeTimers();
		try {
			let polls = 0;
			const { client } = fakeGraph((call) => {
				if (call.path === "ig-1/media") {
					return { body: { id: "c1" } };
				}
				if (call.path === "c1") {
					polls += 1;
					return {
						body: { status_code: polls < 2 ? "IN_PROGRESS" : "FINISHED" },
					};
				}
				return { body: { id: "m1" } };
			});
			const real = new MetaSocialPublisher({
				client,
				credentialsFor: async (platform) => ({
					accountId: "a",
					platform,
					accountRemoteId: "x",
					accessToken: TOKEN,
				}),
			});
			const pending = real.publish(request("INSTAGRAM"));
			await vi.runAllTimersAsync();
			expect((await pending).isOk()).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("MetaSocialPublisher — Instagram por outro host (token do .env, §15)", () => {
	it("todas as chamadas do Instagram vão para o cliente do Instagram", async () => {
		const facebook = fakeGraph(() => ({ body: {} }));
		const instagram = fakeGraph((call) => {
			if (call.path === "ig-1/content_publishing_limit") {
				return { body: { data: [] } };
			}
			if (call.method === "POST" && call.path === "ig-1/media") {
				return { body: { id: "c1" } };
			}
			if (call.path === "c1") {
				return { body: { status_code: "FINISHED" } };
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "m1" } };
			}
			return { body: { permalink: "https://instagram.com/p/x" } };
		});

		const result = await publisher(facebook.client, {
			instagramClient: instagram.client,
			checkQuota: true,
		}).publish(request("INSTAGRAM"));

		expect(result.unwrap()).toEqual({
			remoteId: "m1",
			permalink: "https://instagram.com/p/x",
		});
		expect(instagram.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
			"GET ig-1/content_publishing_limit",
			"POST ig-1/media",
			"GET c1",
			"POST ig-1/media_publish",
			"GET m1",
		]);
		expect(facebook.calls).toHaveLength(0);
	});

	it("o Facebook continua no cliente do Facebook", async () => {
		const facebook = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "f", post_id: "page-1_1" } }
				: { body: {} },
		);
		const instagram = fakeGraph(() => ({ body: {} }));

		await publisher(facebook.client, {
			instagramClient: instagram.client,
		}).publish(request("FACEBOOK"));

		expect(facebook.calls.length).toBeGreaterThan(0);
		expect(instagram.calls).toHaveLength(0);
	});
});

describe("MetaSocialPublisher — Stories do Instagram (§17)", () => {
	const story = (images = [imagem("s1")]) => ({
		...request("INSTAGRAM", images, ""),
		format: "STORY" as const,
	});

	function roteiroDoStory(call: Call): Reply {
		if (call.path === "ig-1/content_publishing_limit") {
			return {
				body: {
					data: [{ quota_usage: 1, config: { quota_total: 100 } }],
				},
			};
		}
		if (call.method === "POST" && call.path === "ig-1/media") {
			return { body: { id: "c-story" } };
		}
		if (call.path === "c-story") {
			return { body: { status_code: "FINISHED" } };
		}
		if (call.path === "ig-1/media_publish") {
			return { body: { id: "story-1" } };
		}
		return { body: { permalink: "https://instagram.com/stories/x/1" } };
	}

	it("container STORIES com a imagem e sem legenda; espera, publica e busca o link", async () => {
		const { calls, client } = fakeGraph(roteiroDoStory);

		const result = await publisher(client).publish(story());

		expect(result.unwrap()).toEqual({
			remoteId: "story-1",
			permalink: "https://instagram.com/stories/x/1",
		});
		expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
			"POST ig-1/media",
			"GET c-story",
			"POST ig-1/media_publish",
			"GET story-1",
		]);
		expect(calls[0]?.params.get("media_type")).toBe("STORIES");
		expect(calls[0]?.params.get("image_url")).toBe("https://cdn.test/s1.jpg");
		expect(calls[0]?.params.has("caption")).toBe(false);
		expect(calls[0]?.params.has("is_carousel_item")).toBe(false);
		expect(calls[2]?.params.get("creation_id")).toBe("c-story");
	});

	it("com o token do .env, vai inteiro para o host do Instagram e consulta a cota", async () => {
		const facebook = fakeGraph(() => ({ body: {} }));
		const instagram = fakeGraph(roteiroDoStory);

		const result = await publisher(facebook.client, {
			instagramClient: instagram.client,
			checkQuota: true,
		}).publish(story());

		expect(result.isOk()).toBe(true);
		expect(instagram.calls[0]?.path).toBe("ig-1/content_publishing_limit");
		expect(facebook.calls).toHaveLength(0);
	});

	it("cota esgotada barra o story antes de criar o container", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.path === "ig-1/content_publishing_limit"
				? {
						body: {
							data: [{ quota_usage: 100, config: { quota_total: 100 } }],
						},
					}
				: roteiroDoStory(call),
		);

		const failure = (
			await publisher(client, { checkQuota: true }).publish(story())
		).unwrapErr();

		expect(failure.providerCode).toBe("QUOTA_EXCEEDED");
		expect(calls).toHaveLength(1);
	});

	it("erro ao criar o container do story é traduzido e não publica", async () => {
		const { calls, client } = fakeGraph(() => ({
			status: 400,
			body: { error: { message: "bad image", code: 9004 } },
		}));

		const failure = (await publisher(client).publish(story())).unwrapErr();

		expect(failure.reason).toContain("baixar a imagem");
		expect(calls).toHaveLength(1);
	});

	it("story com ERROR no processamento não chega ao media_publish", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "c-story" } }
				: { body: { status_code: "ERROR" } },
		);
		const failure = (await publisher(client).publish(story())).unwrapErr();
		expect(failure.providerCode).toBe("CONTAINER_ERROR");
		expect(calls.some((c) => c.path === "ig-1/media_publish")).toBe(false);
	});

	it("story no Facebook é recusado sem chamar a Meta", async () => {
		const { calls, client } = fakeGraph(() => ({ body: {} }));

		const failure = (
			await publisher(client).publish({
				...request("FACEBOOK"),
				format: "STORY",
			})
		).unwrapErr();

		expect(failure.providerCode).toBe("STORY_UNSUPPORTED");
		expect(failure.retryable).toBe(false);
		expect(calls).toHaveLength(0);
	});
});

describe("MetaSocialPublisher — cota do Instagram (D13)", () => {
	const cota = (usage: number, total = 50): Reply => ({
		body: {
			data: [
				{
					quota_usage: usage,
					config: { quota_total: total, quota_duration: 86400 },
				},
			],
		},
	});

	/** O caminho feliz de uma foto, com a resposta da cota escolhida pelo teste. */
	function roteiro(quota: Reply) {
		return (call: Call): Reply => {
			if (call.path === "ig-1/content_publishing_limit") {
				return quota;
			}
			if (call.method === "POST" && call.path === "ig-1/media") {
				return { body: { id: "c1" } };
			}
			if (call.path === "c1") {
				return { body: { status_code: "FINISHED" } };
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "m1" } };
			}
			return { body: {} };
		};
	}

	it("cota esgotada: nem cria container, e não é repetível pelo worker", async () => {
		// A cota volta em horas; as tentativas automáticas são de minutos e só
		// queimariam a fila.
		const { calls, client } = fakeGraph(roteiro(cota(50)));

		const failure = (
			await publisher(client, { checkQuota: true }).publish(
				request("INSTAGRAM"),
			)
		).unwrapErr();

		expect(failure.providerCode).toBe("QUOTA_EXCEEDED");
		expect(failure.retryable).toBe(false);
		expect(failure.reason).toContain("limite de 50");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.params.get("fields")).toBe("config,quota_usage");
		expect(calls[0]?.params.get("access_token")).toBe(TOKEN);
	});

	it("cota com folga: consulta primeiro e publica", async () => {
		const { calls, client } = fakeGraph(roteiro(cota(3)));

		const result = await publisher(client, { checkQuota: true }).publish(
			request("INSTAGRAM"),
		);

		expect(result.isOk()).toBe(true);
		expect(calls[0]?.path).toBe("ig-1/content_publishing_limit");
		expect(calls[1]?.path).toBe("ig-1/media");
	});

	it("consulta de cota que falha NÃO impede a publicação", async () => {
		// Não saber a cota é diferente de não ter cota: bloquear aqui trocaria um
		// erro raro por um bloqueio certo.
		const { client } = fakeGraph(
			roteiro({ status: 500, body: { error: { message: "x", code: 1 } } }),
		);
		const result = await publisher(client, { checkQuota: true }).publish(
			request("INSTAGRAM"),
		);
		expect(result.isOk()).toBe(true);
	});

	it("resposta de cota em formato inesperado é ignorada", async () => {
		const { client } = fakeGraph(roteiro({ body: { data: [] } }));
		const result = await publisher(client, { checkQuota: true }).publish(
			request("INSTAGRAM"),
		);
		expect(result.isOk()).toBe(true);
	});

	it("quota_total zero é tratada como resposta inválida, não como bloqueio", async () => {
		const { client } = fakeGraph(roteiro(cota(0, 0)));
		const result = await publisher(client, { checkQuota: true }).publish(
			request("INSTAGRAM"),
		);
		expect(result.isOk()).toBe(true);
	});

	it("o Facebook não tem essa cota e não a consulta", async () => {
		const { calls, client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "f", post_id: "page-1_1" } }
				: { body: {} },
		);
		await publisher(client, { checkQuota: true }).publish(request("FACEBOOK"));
		expect(calls.some((c) => c.path.includes("content_publishing_limit"))).toBe(
			false,
		);
	});
});

// ── vídeo: Reels e story em vídeo (spec 12) ───────────────────────────────

const video = {
	url: "https://cdn.test/reel.mp4",
	coverUrl: "https://cdn.test/reel.jpg",
	altText: "",
};

const videoRequest = (
	format: "REEL" | "STORY",
	over: Record<string, unknown> = {},
) => ({
	platform: "INSTAGRAM" as const,
	format,
	accountRemoteId: "ig-1",
	caption: "Entrevista com o prefeito",
	images: [],
	video,
	linkUrl: null,
	...over,
});

/** O roteiro feliz do container: cria, termina, publica, devolve o link. */
function containerFeliz() {
	return fakeGraph((call) => {
		if (call.method === "POST" && call.path === "ig-1/media") {
			return { body: { id: "c-video" } };
		}
		if (call.path === "c-video") {
			return { body: { status_code: "FINISHED" } };
		}
		if (call.path === "ig-1/media_publish") {
			return { body: { id: "reel-1" } };
		}
		return { body: { permalink: "https://instagram.com/reel/abc" } };
	});
}

describe("MetaSocialPublisher — Reels", () => {
	it("cria o container REELS com vídeo, legenda e capa", async () => {
		const { calls, client } = containerFeliz();

		const result = await publisher(client).publish(videoRequest("REEL"));

		expect(result.unwrap().remoteId).toBe("reel-1");
		const container = calls[0]?.params as URLSearchParams;
		expect(container.get("media_type")).toBe("REELS");
		expect(container.get("video_url")).toBe(video.url);
		expect(container.get("caption")).toBe("Entrevista com o prefeito");
		expect(container.get("cover_url")).toBe(video.coverUrl);
	});

	it("pede para aparecer TAMBÉM na grade do perfil", () => {
		// Sem `share_to_feed`, o vídeo sai só na aba de Reels e a matéria some do
		// lugar onde o leitor do portal costuma procurá-la.
		const { calls, client } = containerFeliz();
		return publisher(client)
			.publish(videoRequest("REEL"))
			.then(() => {
				expect(calls[0]?.params.get("share_to_feed")).toBe("true");
			});
	});

	it("sem capa, deixa a Meta escolher um quadro", async () => {
		const { calls, client } = containerFeliz();

		await publisher(client).publish(
			videoRequest("REEL", { video: { ...video, coverUrl: null } }),
		);

		expect(calls[0]?.params.has("cover_url")).toBe(false);
	});

	it("espera o container terminar ANTES de publicar", async () => {
		let perguntas = 0;
		const { calls, client } = fakeGraph((call) => {
			if (call.method === "POST" && call.path === "ig-1/media") {
				return { body: { id: "c-video" } };
			}
			if (call.path === "c-video") {
				perguntas += 1;
				return {
					body: { status_code: perguntas < 2 ? "IN_PROGRESS" : "FINISHED" },
				};
			}
			if (call.path === "ig-1/media_publish") {
				return { body: { id: "reel-1" } };
			}
			return { body: { permalink: null } };
		});

		await publisher(client, {
			videoPollAttempts: 3,
			videoPollIntervalMs: 1,
		}).publish(videoRequest("REEL"));

		expect(perguntas).toBe(2);
		expect(calls.map((call) => call.path)).toEqual([
			"ig-1/media",
			"c-video",
			"c-video",
			"ig-1/media_publish",
			"reel-1",
		]);
	});

	it("processamento que não termina é falha REPETÍVEL, e fala de vídeo", async () => {
		const { client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "c-video" } }
				: { body: { status_code: "IN_PROGRESS" } },
		);

		const failure = await publisher(client, {
			videoPollAttempts: 2,
			videoPollIntervalMs: 1,
		})
			.publish(videoRequest("REEL"))
			.then((result) => result.unwrapErr());

		expect(failure.retryable).toBe(true);
		expect(failure.reason).toContain("o vídeo");
	});

	it("container com ERRO fala de duração e formato, não de JPEG", async () => {
		const { client } = fakeGraph((call) =>
			call.method === "POST"
				? { body: { id: "c-video" } }
				: { body: { status_code: "ERROR" } },
		);

		const failure = await publisher(client)
			.publish(videoRequest("REEL"))
			.then((result) => result.unwrapErr());

		expect(failure.retryable).toBe(false);
		expect(failure.reason).toContain("duração");
	});

	it("Reels sem vídeo é recusado sem chamar a Meta", async () => {
		const { calls, client } = containerFeliz();

		const failure = await publisher(client)
			.publish(videoRequest("REEL", { video: null, images: [] }))
			.then((result) => result.unwrapErr());

		expect(failure.providerCode).toBe("VIDEO_REQUIRED");
		expect(calls).toHaveLength(0);
	});

	it("Reels no Facebook é recusado sem chamar a Meta", async () => {
		const { calls, client } = containerFeliz();

		const failure = await publisher(client)
			.publish(videoRequest("REEL", { platform: "FACEBOOK" }))
			.then((result) => result.unwrapErr());

		expect(failure.providerCode).toBe("REEL_UNSUPPORTED");
		expect(calls).toHaveLength(0);
	});

	it("vídeo para o Facebook é recusado sem chamar a Meta", async () => {
		const { calls, client } = containerFeliz();

		const failure = await publisher(client)
			.publish(videoRequest("REEL", { platform: "FACEBOOK", format: "FEED" }))
			.then((result) => result.unwrapErr());

		expect(failure.providerCode).toBe("VIDEO_UNSUPPORTED");
		expect(calls).toHaveLength(0);
	});
});

describe("MetaSocialPublisher — story em vídeo", () => {
	it("cria o container STORIES com o vídeo, sem legenda", async () => {
		const { calls, client } = containerFeliz();

		const result = await publisher(client).publish(videoRequest("STORY"));

		expect(result.unwrap().remoteId).toBe("reel-1");
		expect(calls[0]?.params.get("media_type")).toBe("STORIES");
		expect(calls[0]?.params.get("video_url")).toBe(video.url);
		expect(calls[0]?.params.has("caption")).toBe(false);
	});

	it("story com imagem continua sendo story de imagem", async () => {
		const { calls, client } = containerFeliz();

		await publisher(client).publish(
			videoRequest("STORY", { video: null, images: [imagem("m1")] }),
		);

		expect(calls[0]?.params.get("image_url")).toBe("https://cdn.test/m1.jpg");
		expect(calls[0]?.params.has("video_url")).toBe(false);
	});
});
