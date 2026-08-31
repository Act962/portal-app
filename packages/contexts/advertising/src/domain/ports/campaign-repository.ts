import type { PageRequest } from "@portal-app/shared-kernel";

import type { AdSlot } from "../ad-slot";
import type { AdSenseSettings } from "../adsense-settings";
import type { Campaign } from "../campaign";

/** Filtro da lista do painel. */
export type CampaignFilter = {
	slot?: AdSlot;
	advertiser?: string;
	search?: string;
	/** Só as que podem aparecer agora — o recorte que a veiculação usa. */
	liveAt?: Date;
};

export interface CampaignRepository {
	findById(id: string): Promise<Campaign | null>;
	save(campaign: Campaign): Promise<void>;
	delete(id: string): Promise<void>;
	list(filter?: CampaignFilter, page?: PageRequest): Promise<Campaign[]>;
	count(filter?: CampaignFilter): Promise<number>;
	/**
	 * As candidatas de uma posição, para a veiculação.
	 *
	 * Recebe a posição e o instante e devolve TODAS as que estão no ar ali —
	 * filtrar por editoria e sortear é regra de domínio (`select-ad.ts`), não do
	 * banco. Manter o `where` bobo é o que permite testar a regra sem Postgres.
	 */
	liveForSlot(slot: AdSlot, now: Date): Promise<Campaign[]>;
	/** Quantas campanhas usam esta imagem — a biblioteca de mídia pergunta antes
	 * de deixar apagar um arquivo. */
	countUsingMedia(mediaId: string): Promise<number>;
}

/** A configuração do AdSense é um registro único; a porta é separada da de
 * campanhas porque as duas mudam por motivos diferentes. */
export interface AdSenseSettingsRepository {
	load(): Promise<AdSenseSettings>;
	save(settings: AdSenseSettings): Promise<void>;
}

/**
 * O CONTADOR de impressões e cliques.
 *
 * Porta separada do repositório porque a natureza da escrita é outra: campanha
 * se salva inteira, de vez em quando; evento chega aos milhares e só sabe
 * somar. Misturar as duas faria toda impressão carregar e regravar um agregado.
 */
export type AdStats = {
	campaignId: string;
	impressions: number;
	clicks: number;
};

export interface AdStatsCounter {
	recordImpression(campaignId: string, on: Date): Promise<void>;
	recordClick(campaignId: string, on: Date): Promise<void>;
	/** Totais por campanha no período (início inclusivo, fim exclusivo). */
	statsFor(
		campaignIds: readonly string[],
		from: Date,
		to: Date,
	): Promise<AdStats[]>;
}

/** Fake in-memory — roda no MESMO contrato que o adapter Prisma. */
export class InMemoryCampaignRepository implements CampaignRepository {
	private readonly store = new Map<string, Campaign>();

	findById(id: string): Promise<Campaign | null> {
		return Promise.resolve(this.store.get(id) ?? null);
	}

	save(campaign: Campaign): Promise<void> {
		this.store.set(campaign.id, campaign);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.store.delete(id);
		return Promise.resolve();
	}

	list(filter?: CampaignFilter, page?: PageRequest): Promise<Campaign[]> {
		const result = this.matching(filter);
		if (!page) {
			return Promise.resolve(result);
		}
		return Promise.resolve(result.slice(page.offset, page.offset + page.limit));
	}

	count(filter?: CampaignFilter): Promise<number> {
		return Promise.resolve(this.matching(filter).length);
	}

	liveForSlot(slot: AdSlot, now: Date): Promise<Campaign[]> {
		return Promise.resolve(
			this.matching({ slot, liveAt: now }).sort((a, b) =>
				a.id.localeCompare(b.id),
			),
		);
	}

	countUsingMedia(mediaId: string): Promise<number> {
		return Promise.resolve(
			[...this.store.values()].filter((c) => c.creative?.mediaId === mediaId)
				.length,
		);
	}

	private matching(filter?: CampaignFilter): Campaign[] {
		const term = filter?.search?.trim().toLowerCase();
		return [...this.store.values()]
			.filter((c) => (filter?.slot ? c.slot === filter.slot : true))
			.filter((c) =>
				filter?.advertiser ? c.advertiser === filter.advertiser : true,
			)
			.filter((c) =>
				term
					? c.name.toLowerCase().includes(term) ||
						c.advertiser.toLowerCase().includes(term)
					: true,
			)
			.filter((c) => (filter?.liveAt ? c.isLiveAt(filter.liveAt) : true))
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	clear(): void {
		this.store.clear();
	}
}

/** Fake do contador. Guarda por dia, como o adapter real. */
export class InMemoryAdStatsCounter implements AdStatsCounter {
	private readonly rows = new Map<
		string,
		{ campaignId: string; day: string; impressions: number; clicks: number }
	>();

	recordImpression(campaignId: string, on: Date): Promise<void> {
		this.bump(campaignId, on, "impressions");
		return Promise.resolve();
	}

	recordClick(campaignId: string, on: Date): Promise<void> {
		this.bump(campaignId, on, "clicks");
		return Promise.resolve();
	}

	statsFor(
		campaignIds: readonly string[],
		from: Date,
		to: Date,
	): Promise<AdStats[]> {
		const totals = new Map<string, AdStats>();
		for (const id of campaignIds) {
			totals.set(id, { campaignId: id, impressions: 0, clicks: 0 });
		}
		for (const row of this.rows.values()) {
			const day = new Date(`${row.day}T00:00:00.000Z`).getTime();
			if (day < from.getTime() || day >= to.getTime()) {
				continue;
			}
			const total = totals.get(row.campaignId);
			if (total) {
				total.impressions += row.impressions;
				total.clicks += row.clicks;
			}
		}
		return Promise.resolve([...totals.values()]);
	}

	private bump(
		campaignId: string,
		on: Date,
		field: "impressions" | "clicks",
	): void {
		const day = dayKey(on);
		const key = `${campaignId}|${day}`;
		const row = this.rows.get(key) ?? {
			campaignId,
			day,
			impressions: 0,
			clicks: 0,
		};
		row[field] += 1;
		this.rows.set(key, row);
	}

	clear(): void {
		this.rows.clear();
	}
}

/** O dia UTC de um instante, no formato `YYYY-MM-DD`. Exportado porque o
 * adapter Prisma precisa usar EXATAMENTE o mesmo corte — se um usar UTC e o
 * outro o fuso local, o relatório de "ontem" muda conforme onde roda. */
export function dayKey(on: Date): string {
	return on.toISOString().slice(0, 10);
}

/** Reexportado para o fake e o adapter compartilharem o tipo. */
export type { Campaign };
