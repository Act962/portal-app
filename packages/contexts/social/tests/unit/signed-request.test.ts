import { createHmac } from "node:crypto";
import { parseSignedRequest } from "@portal-app/social/infrastructure/meta/signed-request";
import { describe, expect, it } from "vitest";

const SECRET = "segredo-do-app";

/** Monta um `signed_request` do jeito que a Meta monta. */
function sign(payload: unknown, secret = SECRET): string {
	const body = Buffer.from(
		typeof payload === "string" ? payload : JSON.stringify(payload),
	).toString("base64url");
	const signature = createHmac("sha256", secret)
		.update(body)
		.digest("base64url");
	return `${signature}.${body}`;
}

const valido = {
	algorithm: "HMAC-SHA256",
	user_id: "218471",
	issued_at: 1_789_000_000,
};

describe("parseSignedRequest", () => {
	it("abre o pedido assinado com o segredo do App", () => {
		expect(parseSignedRequest(sign(valido), SECRET)).toEqual({
			userId: "218471",
			issuedAt: 1_789_000_000,
		});
	});

	it("recusa assinatura feita com outro segredo", () => {
		// É esta checagem que impede qualquer um de chamar a rota que apaga as
		// credenciais do portal.
		expect(parseSignedRequest(sign(valido, "outro"), SECRET)).toBeNull();
	});

	it("recusa payload trocado depois de assinado", () => {
		const [signature] = sign(valido).split(".");
		const forjado = Buffer.from(
			JSON.stringify({ ...valido, user_id: "999" }),
		).toString("base64url");
		expect(parseSignedRequest(`${signature}.${forjado}`, SECRET)).toBeNull();
	});

	it("recusa formato quebrado", () => {
		expect(parseSignedRequest("", SECRET)).toBeNull();
		expect(parseSignedRequest("semponto", SECRET)).toBeNull();
		expect(parseSignedRequest(`${sign(valido)}.extra`, SECRET)).toBeNull();
	});

	it("recusa algoritmo diferente do documentado", () => {
		expect(
			parseSignedRequest(sign({ ...valido, algorithm: "none" }), SECRET),
		).toBeNull();
	});

	it("aceita o algoritmo em minúsculas", () => {
		expect(
			parseSignedRequest(sign({ ...valido, algorithm: "hmac-sha256" }), SECRET)
				?.userId,
		).toBe("218471");
	});

	it("recusa pedido sem usuário", () => {
		expect(
			parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }), SECRET),
		).toBeNull();
	});

	it("aceita user_id numérico e issued_at ausente", () => {
		expect(
			parseSignedRequest(
				sign({ algorithm: "HMAC-SHA256", user_id: 42 }),
				SECRET,
			),
		).toEqual({ userId: "42", issuedAt: 0 });
	});

	it("recusa payload que não é objeto JSON, mesmo bem assinado", () => {
		expect(parseSignedRequest(sign("não é json"), SECRET)).toBeNull();
		expect(parseSignedRequest(sign("null"), SECRET)).toBeNull();
	});
});
