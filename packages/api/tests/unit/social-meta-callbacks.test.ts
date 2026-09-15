import { describe, it } from "vitest";

/**
 * Esqueleto das rotas que a Meta chama (spec 08, §14) — regra 2 do CLAUDE.md.
 *
 * A lógica que decide está testada onde mora: a assinatura em
 * `signed-request.test.ts`, a exclusão em `forget-credentials.test.ts` e no
 * contrato de integração. O que falta é a COLA das rotas
 * (`apps/web/src/app/api/social/meta/{deauthorize,data-deletion}/route.ts` e
 * `metaSignedRequestFrom` em `packages/api/src/social.ts`), que depende do env
 * da Meta carregado no módulo.
 */
describe("metaSignedRequestFrom", () => {
	it.todo("sem App configurado devolve null, mesmo com assinatura válida");
	it.todo("lê o signed_request de um corpo x-www-form-urlencoded");
	it.todo("corpo que não é formulário devolve null em vez de lançar");
});

describe("POST /api/social/meta/deauthorize", () => {
	it.todo("assinatura inválida responde 400 e não apaga nada");
	it.todo("assinatura válida apaga as credenciais e responde 200");
});

describe("POST /api/social/meta/data-deletion", () => {
	it.todo("assinatura inválida responde 400 e não apaga nada");
	it.todo(
		"assinatura válida responde { url, confirmation_code } com a url da página de acompanhamento",
	);
	it.todo("o código devolvido tem o formato que a página aceita (16 hex)");
});
