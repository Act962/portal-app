import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Page,
	type PageRequest,
	type Result,
} from "@portal-app/shared-kernel";

import type { AdSlot } from "../domain/ad-slot";
import type { AdSenseData } from "../domain/adsense-settings";
import { AdSenseSettings } from "../domain/adsense-settings";
import { Campaign, type Creative } from "../domain/campaign";
import {
	type AdvertiserRequired,
	type CampaignNameRequired,
	CampaignNotFound,
	type CampaignNotReady,
	type InvalidDestination,
	type InvalidFlight,
	type InvalidPublisherId,
	type InvalidSlot,
	type InvalidWeight,
} from "../domain/errors";
import type {
	AdSenseSettingsRepository,
	AdStats,
	AdStatsCounter,
	CampaignFilter,
	CampaignRepository,
} from "../domain/ports/campaign-repository";
import {
	type AdDecision,
	decideAd,
	eligibleCampaigns,
} from "../domain/select-ad";

/**
 * Casos de uso da publicidade. Orquestram sem regra: a regra vive no agregado
 * `Campaign` e em `select-ad.ts`.
 *
 * A autorização é `ads:manage`, que na matriz é só de ADMIN — publicidade é
 * receita, e receita não é assunto de redação. Um editor não deve conseguir
 * subir um anúncio, nem por engano.
 */
export type Deps = {
	repo: CampaignRepository;
	settings: AdSenseSettingsRepository;
	stats: AdStatsCounter;
	clock: Clock;
	ids: IdGenerator;
};

type CampaignInput = {
	name: string;
	advertiser: string;
	slot: string;
	destinationUrl: string;
	startsAt: Date;
	endsAt: Date | null;
	weight?: number;
	sectionIds?: readonly string[];
	creative?: Creative | null;
};

type CreateError =
	| Forbidden
	| CampaignNameRequired
	| AdvertiserRequired
	| InvalidSlot
	| InvalidDestination
	| InvalidFlight
	| InvalidWeight;

export async function createCampaign(
	actor: StaffMember,
	input: CampaignInput,
	deps: Pick<Deps, "repo" | "clock" | "ids">,
): Promise<Result<Campaign, CreateError>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const campaign = Campaign.create({
		...input,
		id: deps.ids.generate(),
		createdAt: deps.clock.now(),
	});
	if (campaign.isErr()) {
		return err(campaign.error);
	}
	await deps.repo.save(campaign.value);
	return ok(campaign.value);
}

export async function updateCampaign(
	actor: StaffMember,
	input: Partial<CampaignInput> & { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<Campaign, CreateError | CampaignNotFound>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const campaign = await deps.repo.findById(input.id);
	if (!campaign) {
		return err(new CampaignNotFound(input.id));
	}
	const edited = campaign.edit(input);
	if (edited.isErr()) {
		return err(edited.error);
	}
	await deps.repo.save(campaign);
	return ok(campaign);
}

export async function activateCampaign(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<Campaign, Forbidden | CampaignNotFound | CampaignNotReady>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const campaign = await deps.repo.findById(input.id);
	if (!campaign) {
		return err(new CampaignNotFound(input.id));
	}
	const activated = campaign.activate();
	if (activated.isErr()) {
		return err(activated.error);
	}
	await deps.repo.save(campaign);
	return ok(campaign);
}

export async function pauseCampaign(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<Campaign, Forbidden | CampaignNotFound>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const campaign = await deps.repo.findById(input.id);
	if (!campaign) {
		return err(new CampaignNotFound(input.id));
	}
	campaign.pause();
	await deps.repo.save(campaign);
	return ok(campaign);
}

export async function deleteCampaign(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, Forbidden | CampaignNotFound>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const campaign = await deps.repo.findById(input.id);
	if (!campaign) {
		return err(new CampaignNotFound(input.id));
	}
	await deps.repo.delete(input.id);
	return ok(undefined);
}

export async function listCampaigns(
	filter: CampaignFilter,
	deps: Pick<Deps, "repo">,
	page?: PageRequest,
): Promise<Page<Campaign>> {
	const [items, total] = await Promise.all([
		deps.repo.list(filter, page),
		deps.repo.count(filter),
	]);
	return { items, total };
}

export function getCampaign(
	id: string,
	deps: Pick<Deps, "repo">,
): Promise<Campaign | null> {
	return deps.repo.findById(id);
}

/**
 * O QUE SERVIR numa posição. É o que o portal chama a cada página.
 *
 * O `roll` vem de fora — de quem carregou a página, uma vez por visita. Não é
 * detalhe de teste: o portal é servido de CACHE (`revalidate = 60`), então um
 * sorteio feito aqui, no servidor, ficaria congelado junto com o HTML e todo
 * mundo veria a mesma campanha durante um minuto inteiro. O rodízio só é
 * rodízio se o acaso entrar depois do cache.
 */
export async function decideAdForSlot(
	input: { slot: AdSlot; sectionId: string | null; roll: number },
	deps: Pick<Deps, "repo" | "settings" | "clock">,
): Promise<AdDecision> {
	const now = deps.clock.now();
	const [campaigns, settings] = await Promise.all([
		deps.repo.liveForSlot(input.slot, now),
		deps.settings.load(),
	]);
	return decideAd(campaigns, {
		slot: input.slot,
		sectionId: input.sectionId,
		now,
		roll: input.roll,
		adsenseEnabled: settings.servesSlot(input.slot),
	});
}

/**
 * Todas as candidatas de uma posição, para o CLIENTE sortear.
 *
 * Existe além de `decideAdForSlot` por causa do cache: o servidor manda a lista
 * (que muda pouco e pode ser cacheada à vontade) e o navegador sorteia a cada
 * carregamento. Assim o rodízio funciona mesmo com a página inteira em cache.
 */
export async function candidatesForSlot(
	input: { slot: AdSlot; sectionId: string | null },
	deps: Pick<Deps, "repo" | "settings" | "clock">,
): Promise<{ campaigns: Campaign[]; adsenseEnabled: boolean }> {
	const now = deps.clock.now();
	const [campaigns, settings] = await Promise.all([
		deps.repo.liveForSlot(input.slot, now),
		deps.settings.load(),
	]);
	return {
		campaigns: [
			...eligibleCampaigns(campaigns, {
				slot: input.slot,
				sectionId: input.sectionId,
				now,
			}),
		],
		adsenseEnabled: settings.servesSlot(input.slot),
	};
}

/**
 * Registra uma impressão ou um clique.
 *
 * SEM ATOR e sem autorização: quem dispara é o navegador de um leitor anônimo.
 * O que protege isto de ser inflado por um robô não é permissão, é o fato de a
 * contagem existir para a NOSSA leitura comercial, não para faturar por clique.
 * Nenhum dado pessoal entra aqui — só o id da campanha e o dia (LGPD/N09, a
 * mesma régua do log de leitura).
 */
export async function recordAdEvent(
	input: { campaignId: string; type: "impression" | "click" },
	deps: Pick<Deps, "repo" | "stats" | "clock">,
): Promise<Result<void, CampaignNotFound>> {
	// Confere que a campanha existe antes de somar: sem isto, qualquer id
	// inventado criaria linha de estatística, e o relatório encheria de lixo que
	// ninguém consegue mais associar a nada.
	const campaign = await deps.repo.findById(input.campaignId);
	if (!campaign) {
		return err(new CampaignNotFound(input.campaignId));
	}
	const now = deps.clock.now();
	if (input.type === "impression") {
		await deps.stats.recordImpression(input.campaignId, now);
	} else {
		await deps.stats.recordClick(input.campaignId, now);
	}
	return ok(undefined);
}

export async function campaignStats(
	actor: StaffMember,
	input: { campaignIds: readonly string[]; from: Date; to: Date },
	deps: Pick<Deps, "stats">,
): Promise<Result<AdStats[], Forbidden>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	return ok(await deps.stats.statsFor(input.campaignIds, input.from, input.to));
}

export async function loadAdSenseSettings(
	deps: Pick<Deps, "settings">,
): Promise<AdSenseSettings> {
	return deps.settings.load();
}

export async function changeAdSenseSettings(
	actor: StaffMember,
	input: Partial<AdSenseData>,
	deps: Pick<Deps, "settings">,
): Promise<Result<AdSenseSettings, Forbidden | InvalidPublisherId>> {
	if (!can(actor, "ads:manage")) {
		return err(new Forbidden());
	}
	const current = await deps.settings.load();
	const next = AdSenseSettings.change(input, current.data);
	if (next.isErr()) {
		return err(next.error);
	}
	await deps.settings.save(next.value);
	return ok(next.value);
}
