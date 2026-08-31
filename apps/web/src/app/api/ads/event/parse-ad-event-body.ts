/**
 * Lê o corpo do beacon de anúncio, com desconfiança.
 *
 * Separado da rota para ser TESTÁVEL sem subir servidor nem banco — a rota em
 * si é três linhas de fiação, e o que erra é isto aqui. O corpo vem de um
 * endpoint público: qualquer coisa pode chegar, e nada disso pode virar exceção
 * numa rota que responde a milhares de beacons.
 */
export type AdEvent = { campaignId: string; type: "impression" | "click" };

export function parseAdEventBody(raw: string): AdEvent | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return null;
	}
	const body = parsed as Record<string, unknown>;
	const campaignId = body.campaignId;
	const type = body.type;

	if (typeof campaignId !== "string" || campaignId.trim() === "") {
		return null;
	}
	// O id vai para uma consulta por chave primária; um valor absurdamente longo
	// é sinal de sondagem, não de uso. Cortar cedo evita carregar o banco com o
	// que já se sabe que não existe.
	if (campaignId.length > 64) {
		return null;
	}
	if (type !== "impression" && type !== "click") {
		return null;
	}
	return { campaignId, type };
}
