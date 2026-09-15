import type { PublishingQuota } from "../../domain/ports/connection-probe";
import type { MetaGraphClient } from "./graph-client";

type QuotaResponse = {
	data?: Array<{
		quota_usage?: number;
		config?: { quota_total?: number; quota_duration?: number };
	}>;
};

/**
 * Quantas publicações a conta do Instagram já fez nas últimas 24 h, e quantas
 * pode fazer (spec 08, D13).
 *
 * `null` quando a Meta não respondeu ou respondeu num formato inesperado — e
 * `null` quer dizer "não sei", não "sem limite". Quem chama segue em frente: a
 * cota é uma cortesia que evita uma chamada perdida, e deixar de publicar
 * porque a CONSULTA falhou trocaria um erro raro por um bloqueio certo.
 */
export async function readInstagramQuota(
	client: MetaGraphClient,
	igUserId: string,
	token: string,
): Promise<PublishingQuota | null> {
	const result = await client.get<QuotaResponse>(
		`${igUserId}/content_publishing_limit`,
		{ fields: "config,quota_usage" },
		token,
	);
	if (result.isErr()) {
		return null;
	}
	const entry = result.unwrap().data?.[0];
	const used = entry?.quota_usage;
	const total = entry?.config?.quota_total;
	if (typeof used !== "number" || typeof total !== "number" || total <= 0) {
		return null;
	}
	return { used, total };
}
