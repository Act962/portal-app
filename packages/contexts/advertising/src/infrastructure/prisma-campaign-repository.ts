import type { PrismaClient } from "@portal-app/db/client";
import type { PageRequest } from "@portal-app/shared-kernel";

import type { AdSlot } from "../domain/ad-slot";
import { type AdSenseData, AdSenseSettings } from "../domain/adsense-settings";
import { Campaign, type CampaignStatus } from "../domain/campaign";
import type {
	AdSenseSettingsRepository,
	AdStats,
	AdStatsCounter,
	CampaignFilter,
	CampaignRepository,
} from "../domain/ports/campaign-repository";
import { dayKey } from "../domain/ports/campaign-repository";

/** Adapter Prisma das campanhas. Única camada que conhece Prisma. */
export class PrismaCampaignRepository implements CampaignRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Campaign | null> {
		const row = await this.prisma.adCampaign.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async save(campaign: Campaign): Promise<void> {
		const data = toPersistence(campaign);
		await this.prisma.adCampaign.upsert({
			where: { id: campaign.id },
			create: data,
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.adCampaign.delete({ where: { id } });
	}

	async list(filter?: CampaignFilter, page?: PageRequest): Promise<Campaign[]> {
		const rows = await this.prisma.adCampaign.findMany({
			where: whereFrom(filter),
			orderBy: { createdAt: "desc" },
			...(page ? { take: page.limit, skip: page.offset } : {}),
		});
		return rows.map(toDomain);
	}

	count(filter?: CampaignFilter): Promise<number> {
		return this.prisma.adCampaign.count({ where: whereFrom(filter) });
	}

	async liveForSlot(slot: AdSlot, now: Date): Promise<Campaign[]> {
		const rows = await this.prisma.adCampaign.findMany({
			where: {
				slot,
				status: "ATIVA",
				startsAt: { lte: now },
				// `endsAt: null` é "sem fim combinado" e continua no ar.
				OR: [{ endsAt: null }, { endsAt: { gt: now } }],
			},
			// Ordem ESTÁVEL: o sorteio por peso caminha pela lista, então uma ordem
			// que muda entre consultas mudaria qual campanha um mesmo `roll`
			// escolhe — e o rodízio deixaria de ser reproduzível para depuração.
			orderBy: { id: "asc" },
		});
		return rows.map(toDomain);
	}

	countUsingMedia(mediaId: string): Promise<number> {
		return this.prisma.adCampaign.count({ where: { coverMediaId: mediaId } });
	}
}

type CampaignRow = {
	id: string;
	name: string;
	advertiser: string;
	slot: string;
	destinationUrl: string;
	coverMediaId: string | null;
	coverAltText: string | null;
	startsAt: Date;
	endsAt: Date | null;
	weight: number;
	sectionIds: string[];
	status: string;
	createdAt: Date;
};

function toPersistence(campaign: Campaign) {
	return {
		id: campaign.id,
		name: campaign.name,
		advertiser: campaign.advertiser,
		slot: campaign.slot,
		destinationUrl: campaign.destination.value,
		coverMediaId: campaign.creative?.mediaId ?? null,
		coverAltText: campaign.creative?.altText ?? null,
		startsAt: campaign.flight.startsAt,
		endsAt: campaign.flight.endsAt,
		weight: campaign.weight,
		sectionIds: [...campaign.sectionIds],
		status: campaign.status,
		createdAt: campaign.createdAt,
	};
}

function toDomain(row: CampaignRow): Campaign {
	return Campaign.restore({
		id: row.id,
		name: row.name,
		advertiser: row.advertiser,
		slot: row.slot as AdSlot,
		destinationUrl: row.destinationUrl,
		startsAt: row.startsAt,
		endsAt: row.endsAt,
		weight: row.weight,
		sectionIds: row.sectionIds,
		creative: row.coverMediaId
			? { mediaId: row.coverMediaId, altText: row.coverAltText ?? "" }
			: null,
		status: row.status as CampaignStatus,
		createdAt: row.createdAt,
	});
}

/** O `where` do filtro, em um lugar só — `list` e `count` precisam concordar. */
function whereFrom(filter?: CampaignFilter) {
	const term = filter?.search?.trim();
	const now = filter?.liveAt;
	return {
		slot: filter?.slot,
		advertiser: filter?.advertiser,
		...(term
			? {
					OR: [
						{ name: { contains: term, mode: "insensitive" as const } },
						{ advertiser: { contains: term, mode: "insensitive" as const } },
					],
				}
			: {}),
		...(now
			? {
					status: "ATIVA",
					startsAt: { lte: now },
					AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
				}
			: {}),
	};
}

/** Adapter da configuração do AdSense. Registro único, id fixo. */
export class PrismaAdSenseSettingsRepository
	implements AdSenseSettingsRepository
{
	constructor(private readonly prisma: PrismaClient) {}

	async load(): Promise<AdSenseSettings> {
		const row = await this.prisma.adSenseSettings.findUnique({
			where: { id: AdSenseSettings.ID },
		});
		if (!row) {
			// Banco sem linha é estado NORMAL (ninguém configurou ainda), não erro:
			// os padrões do domínio já descrevem "AdSense desligado".
			return AdSenseSettings.restore(null);
		}
		return AdSenseSettings.restore({
			publisherId: row.publisherId,
			enabled: row.enabled,
			slotIds: (row.slotIds ?? {}) as AdSenseData["slotIds"],
			nonPersonalized: row.nonPersonalized,
		});
	}

	async save(settings: AdSenseSettings): Promise<void> {
		const data = {
			publisherId: settings.data.publisherId,
			enabled: settings.data.enabled,
			slotIds: settings.data.slotIds,
			nonPersonalized: settings.data.nonPersonalized,
		};
		await this.prisma.adSenseSettings.upsert({
			where: { id: AdSenseSettings.ID },
			create: { id: AdSenseSettings.ID, ...data },
			update: data,
		});
	}
}

/**
 * O contador de impressões e cliques.
 *
 * `upsert` com `increment`, e não "ler, somar, gravar": duas impressões
 * simultâneas na mesma campanha são o caso NORMAL num banner de topo, e a
 * leitura-e-escrita perderia uma delas em silêncio. O `@@unique([campaignId,
 * day])` do schema é o que dá ao upsert em que se ancorar.
 */
export class PrismaAdStatsCounter implements AdStatsCounter {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly newId: () => string,
	) {}

	recordImpression(campaignId: string, on: Date): Promise<void> {
		return this.bump(campaignId, on, "impressions");
	}

	recordClick(campaignId: string, on: Date): Promise<void> {
		return this.bump(campaignId, on, "clicks");
	}

	async statsFor(
		campaignIds: readonly string[],
		from: Date,
		to: Date,
	): Promise<AdStats[]> {
		if (campaignIds.length === 0) {
			return [];
		}
		const rows = await this.prisma.adDailyStat.groupBy({
			by: ["campaignId"],
			where: {
				campaignId: { in: [...campaignIds] },
				day: { gte: startOfUtcDay(from), lt: startOfUtcDay(to) },
			},
			_sum: { impressions: true, clicks: true },
		});
		const found = new Map(
			rows.map((row) => [
				row.campaignId,
				{
					campaignId: row.campaignId,
					impressions: row._sum.impressions ?? 0,
					clicks: row._sum.clicks ?? 0,
				},
			]),
		);
		// Campanha sem evento no período volta com zero, e não some da lista: a
		// tela precisa mostrar "0 cliques", que é uma informação — a ausência da
		// linha pareceria erro de carregamento.
		return campaignIds.map(
			(id) => found.get(id) ?? { campaignId: id, impressions: 0, clicks: 0 },
		);
	}

	private async bump(
		campaignId: string,
		on: Date,
		field: "impressions" | "clicks",
	): Promise<void> {
		const day = startOfUtcDay(on);
		await this.prisma.adDailyStat.upsert({
			where: { campaignId_day: { campaignId, day } },
			create: {
				id: this.newId(),
				campaignId,
				day,
				impressions: field === "impressions" ? 1 : 0,
				clicks: field === "clicks" ? 1 : 0,
			},
			update: { [field]: { increment: 1 } },
		});
	}
}

/** Meia-noite UTC do dia daquele instante — o mesmo corte que `dayKey`. */
function startOfUtcDay(on: Date): Date {
	return new Date(`${dayKey(on)}T00:00:00.000Z`);
}
