import { createHmac, timingSafeEqual } from "node:crypto";

/** O que interessa de um `signed_request` da Meta, já conferido. */
export type SignedRequest = {
	/** O id do usuário NO APP (app-scoped) — não é o id público do Facebook. */
	userId: string;
	/** Segundos desde a época. Zero quando a Meta não mandou. */
	issuedAt: number;
};

/**
 * Confere e abre o `signed_request` que a Meta manda nos avisos de remoção do
 * App e de pedido de exclusão de dados (spec 08, §14).
 *
 * O formato é `assinatura.payload`, os dois em base64url, e a assinatura é o
 * HMAC-SHA256 do payload **ainda codificado** com o segredo do App. Sem esta
 * conferência, as rotas que apagam credenciais seriam um botão público de
 * "desconectar o portal das redes" — qualquer um poderia chamá-las.
 *
 * Devolve `null` para tudo que não passar, sem dizer por quê: quem manda uma
 * assinatura errada não precisa saber qual parte errou.
 */
export function parseSignedRequest(
	signedRequest: string,
	appSecret: string,
): SignedRequest | null {
	const [encodedSignature, payload, ...rest] = signedRequest.split(".");
	if (!encodedSignature || !payload || rest.length > 0) {
		return null;
	}

	const expected = createHmac("sha256", appSecret).update(payload).digest();
	const received = Buffer.from(encodedSignature, "base64url");
	if (
		received.length !== expected.length ||
		!timingSafeEqual(received, expected)
	) {
		return null;
	}

	let data: unknown;
	try {
		data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	} catch {
		return null;
	}
	if (typeof data !== "object" || data === null) {
		return null;
	}

	const { algorithm, user_id, issued_at } = data as Record<string, unknown>;
	if (String(algorithm).toUpperCase() !== "HMAC-SHA256") {
		return null;
	}
	if (typeof user_id !== "string" && typeof user_id !== "number") {
		return null;
	}
	return {
		userId: String(user_id),
		issuedAt: typeof issued_at === "number" ? issued_at : 0,
	};
}
