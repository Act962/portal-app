import { randomBytes } from "node:crypto";
import {
	forgetMetaCredentials,
	metaSignedRequestFrom,
} from "@portal-app/api/social";
import { env } from "@portal-app/env/server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * "URL de callback de solicitação de exclusão de dados" do App da Meta — um dos
 * requisitos para o App Review (spec 08, §14).
 *
 * O contrato da Meta: receber o `signed_request`, apagar os dados, e responder
 * `{ url, confirmation_code }`, onde `url` é uma página que a pessoa pode abrir
 * para acompanhar o pedido.
 *
 * O que o portal guarda de quem conectou é o token (cifrado) e o nome e a foto
 * da Página e do Instagram — nenhum dado do perfil pessoal. A exclusão é
 * SÍNCRONA: termina antes desta resposta sair, e por isso a página de
 * acompanhamento não precisa consultar estado nenhum.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
	const signed = await metaSignedRequestFrom(request);
	if (!signed) {
		return NextResponse.json(
			{ error: "Pedido sem assinatura válida." },
			{ status: 400 },
		);
	}

	const forgotten = await forgetMetaCredentials();
	const code = randomBytes(8).toString("hex");
	console.info("[social] exclusão de dados pedida pela Meta:", {
		code,
		forgotten,
	});

	const status = new URL("/privacidade/exclusao-de-dados", env.BETTER_AUTH_URL);
	status.searchParams.set("codigo", code);
	return NextResponse.json({
		url: status.toString(),
		confirmation_code: code,
	});
}
