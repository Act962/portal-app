import {
	forgetMetaCredentials,
	metaSignedRequestFrom,
} from "@portal-app/api/social";
import { type NextRequest, NextResponse } from "next/server";

/**
 * "URL de retorno de chamada para desautorizar" do App da Meta (spec 08, §14).
 *
 * A Meta chama aqui quando alguém remove o App nas configurações do Facebook.
 * O token de Página derivado daquele login deixa de valer do lado de lá; aqui o
 * portal apaga a cópia cifrada e desliga as contas, para a tela dizer
 * "desconectada" em vez de esperar a próxima publicação falhar com erro 190.
 *
 * Sem sessão, de propósito: quem chama é a Meta. A autenticação é a assinatura
 * do `signed_request` com o segredo do App — sem ela, esta rota seria um botão
 * público de "desligar o portal das redes".
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
	// O id do usuário NÃO vai para o log: é dado pessoal de quem acabou de pedir
	// para o App esquecê-lo.
	console.info(
		"[social] App removido na Meta; credenciais apagadas:",
		forgotten,
	);
	return new NextResponse(null, { status: 200 });
}
