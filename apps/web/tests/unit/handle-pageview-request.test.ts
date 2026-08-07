import {
	InMemoryPageViewLog,
	InMemoryViewCounter,
} from "@portal-app/analytics";
import { beforeEach, describe, expect, it } from "vitest";

import { handlePageviewRequest } from "@/app/api/track/pageview/handle-pageview-request";

let counter: InMemoryViewCounter;
let log: InMemoryPageViewLog;
let deps: { counter: InMemoryViewCounter; log: InMemoryPageViewLog };

beforeEach(() => {
	counter = new InMemoryViewCounter();
	log = new InMemoryPageViewLog();
	deps = { counter, log };
});

/** Mesmo Content-Type que `navigator.sendBeacon` manda de verdade. */
function request(body: string): Request {
	return new Request("http://localhost:3001/api/track/pageview", {
		method: "POST",
		body,
		headers: { "content-type": "text/plain;charset=UTF-8" },
	});
}

const WIDE_RANGE = {
	from: new Date("2000-01-01T00:00:00Z"),
	to: new Date("2100-01-01T00:00:00Z"),
};

describe("handlePageviewRequest — abertura", () => {
	it("conta no contador rápido E abre a linha no log durável", async () => {
		const response = await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);

		expect(response.status).toBe(204);
		expect(await counter.topSlugs(5, new Date())).toEqual(["materia-x"]);
		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged).toHaveLength(1);
		expect(logged[0]?.articleSlug).toBe("materia-x");
		// Sem o beacon de saída ainda, o tempo de leitura fica em aberto.
		expect(logged[0]?.readingSeconds).toBeNull();
	});

	it("classifica a origem a partir do referrer", async () => {
		await handlePageviewRequest(
			request(
				JSON.stringify({
					viewId: "v1",
					slug: "materia-x",
					referrer: "https://www.google.com/search?q=piaui",
				}),
			),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.source).toBe("busca");
	});

	it("navegação a partir do próprio host conta como interna", async () => {
		// O host sai da própria requisição (localhost:3001, aqui) — é o que faz
		// isto funcionar igual em dev, preview e produção sem configuração.
		await handlePageviewRequest(
			request(
				JSON.stringify({
					viewId: "v1",
					slug: "materia-x",
					referrer: "http://localhost:3001/cidades",
				}),
			),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.source).toBe("interno");
	});

	it("sem referrer é tráfego direto", async () => {
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x", referrer: "" })),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.source).toBe("direto");
	});
});

describe("handlePageviewRequest — saída", () => {
	it("fecha o tempo de leitura da visualização aberta", async () => {
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);

		const response = await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", readingSeconds: 90 })),
			deps,
		);

		expect(response.status).toBe(204);
		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.readingSeconds).toBe(90);
	});

	it("o beacon de saída NÃO conta uma segunda visualização", async () => {
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", readingSeconds: 90 })),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged).toHaveLength(1);
	});

	it("beacon de abertura entregue duas vezes não apaga o tempo já medido", async () => {
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", readingSeconds: 90 })),
			deps,
		);
		// Retry do browser: a mesma abertura chega de novo, depois da saída.
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.readingSeconds).toBe(90);
	});

	it("tempo absurdo (aba esquecida a noite toda) é rejeitado", async () => {
		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			deps,
		);

		await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", readingSeconds: 40_000 })),
			deps,
		);

		const logged = await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to);
		expect(logged[0]?.readingSeconds).toBeNull();
	});
});

describe("handlePageviewRequest — robustez", () => {
	it("corpo malformado não derruba a rota", async () => {
		const response = await handlePageviewRequest(request("isto não é json"), deps);

		expect(response.status).toBe(204);
		expect(await counter.topSlugs(5, new Date())).toEqual([]);
	});

	it("slug ausente é rejeitado pelo schema, sem registrar nada", async () => {
		const response = await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1" })),
			deps,
		);

		expect(response.status).toBe(204);
		expect(await log.listBetween(WIDE_RANGE.from, WIDE_RANGE.to)).toEqual([]);
	});

	it("erro de infraestrutura (Redis fora do ar) não derruba a rota", async () => {
		const quebrado = {
			recordView: () => Promise.reject(new Error("Redis indisponível")),
			topSlugs: () => Promise.resolve([]),
		};

		const response = await handlePageviewRequest(
			request(JSON.stringify({ viewId: "v1", slug: "materia-x" })),
			{ counter: quebrado, log },
		);

		expect(response.status).toBe(204);
	});
});
