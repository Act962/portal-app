import { recordAdEvent } from "@portal-app/advertising";
import { adDeps } from "@portal-app/api/advertising";

import { parseAdEventBody } from "./parse-ad-event-body";

/**
 * Registra impressão e clique de campanha da casa.
 *
 * Rota PÚBLICA e sem sessão: quem dispara é o navegador de um leitor anônimo.
 * Nada de dado pessoal entra aqui — nem IP, nem user-agent, nem identificador
 * de leitor (LGPD/N09, a mesma régua do log de leitura). O que se guarda é o id
 * da campanha e o dia.
 *
 * Responde 204 SEMPRE, inclusive para corpo inválido ou campanha inexistente. É
 * deliberado: quem chama é um `sendBeacon`, que não lê resposta e não tem para
 * quem reclamar. Devolver 4xx só encheria o log de erro do servidor com ruído
 * que ninguém vai agir — e, num endpoint público, um erro distinguível é um
 * oráculo para descobrir quais ids de campanha existem.
 */
export async function POST(request: Request): Promise<Response> {
	const parsed = parseAdEventBody(await request.text());
	if (!parsed) {
		return new Response(null, { status: 204 });
	}
	await recordAdEvent(parsed, adDeps);
	return new Response(null, { status: 204 });
}
