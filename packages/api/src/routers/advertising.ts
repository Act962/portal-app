import {
	AD_SLOTS,
	activateCampaign,
	type Campaign,
	campaignStats,
	changeAdSenseSettings,
	createCampaign,
	deleteCampaign,
	getCampaign,
	listCampaigns,
	loadAdSenseSettings,
	MAX_WEIGHT,
	MIN_WEIGHT,
	pauseCampaign,
	updateCampaign,
} from "@portal-app/advertising";
import {
	DEFAULT_PAGE_SIZE,
	type Result,
	toPageRequest,
} from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adDeps } from "../advertising";
import { requirePermission, router } from "../index";

/**
 * Publicidade no painel. Só as mutações do admin vivem aqui (`ads:manage`).
 *
 * A VEICULAÇÃO no portal NÃO passa por este router: é leitura RSC
 * (`apps/web/src/data/ads.ts`), porque o grupo `(site)` é 100% servidor e não
 * carrega o cliente tRPC. E o registro de impressão/clique é uma rota própria
 * (`/api/ads/event`), porque quem o dispara é um leitor anônimo — sem sessão.
 */
const manage = requirePermission("ads:manage");

function campaignDto(campaign: Campaign, now: Date) {
	return {
		id: campaign.id,
		name: campaign.name,
		advertiser: campaign.advertiser,
		slot: campaign.slot,
		destinationUrl: campaign.destination.value,
		destinationHost: campaign.destination.host,
		startsAt: campaign.flight.startsAt,
		endsAt: campaign.flight.endsAt,
		weight: campaign.weight,
		sectionIds: [...campaign.sectionIds],
		isGlobal: campaign.isGlobal,
		creative: campaign.creative,
		status: campaign.status,
		/** O estado que a tela mostra — resolvido contra o relógio do servidor,
		 * para AGENDADA/ENCERRADA não dependerem da hora do computador de quem
		 * abriu o painel. */
		state: campaign.stateAt(now),
		/** O que impede esta campanha de subir, para a tela dizer ANTES do clique. */
		blockers: campaign.activationBlockers(),
		createdAt: campaign.createdAt,
	};
}

function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "Forbidden":
			return "FORBIDDEN";
		case "CampaignNotFound":
			return "NOT_FOUND";
		default:
			return "BAD_REQUEST";
	}
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

const campaignInput = {
	name: z.string(),
	advertiser: z.string(),
	slot: z.enum(AD_SLOTS),
	destinationUrl: z.string(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date().nullish(),
	weight: z.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT).optional(),
	sectionIds: z.array(z.string()).optional(),
	creative: z.object({ mediaId: z.string(), altText: z.string() }).nullish(),
};

export const advertisingRouter = router({
	campaigns: router({
		list: manage
			.input(
				z
					.object({
						slot: z.enum(AD_SLOTS).optional(),
						search: z.string().optional(),
						page: z.number().int().optional(),
						perPage: z.number().int().optional(),
					})
					.optional(),
			)
			.query(async ({ input }) => {
				const { page, perPage, ...filter } = input ?? {};
				const now = adDeps.clock.now();
				const result = await listCampaigns(
					filter,
					adDeps,
					toPageRequest({ page, perPage }),
				);
				return {
					items: result.items.map((campaign) => campaignDto(campaign, now)),
					total: result.total,
					page: page ?? 1,
					perPage: perPage ?? DEFAULT_PAGE_SIZE,
				};
			}),

		get: manage.input(z.object({ id: z.string() })).query(async ({ input }) => {
			const campaign = await getCampaign(input.id, adDeps);
			return campaign ? campaignDto(campaign, adDeps.clock.now()) : null;
		}),

		create: manage
			.input(z.object(campaignInput))
			.mutation(async ({ ctx, input }) =>
				campaignDto(
					ensure(
						await createCampaign(
							ctx.staff,
							{ ...input, endsAt: input.endsAt ?? null },
							adDeps,
						),
					),
					adDeps.clock.now(),
				),
			),

		update: manage
			// Escrito por extenso, e não derivado do `campaignInput` com um `map`:
			// um objeto montado em tempo de execução obriga um cast para o tipo
			// voltar, e um cast aqui é exatamente o lugar onde um campo novo
			// entraria sem validação nenhuma.
			.input(
				z.object({
					id: z.string(),
					name: z.string().optional(),
					advertiser: z.string().optional(),
					slot: z.enum(AD_SLOTS).optional(),
					destinationUrl: z.string().optional(),
					startsAt: z.coerce.date().optional(),
					endsAt: z.coerce.date().nullish(),
					weight: z.number().int().min(MIN_WEIGHT).max(MAX_WEIGHT).optional(),
					sectionIds: z.array(z.string()).optional(),
					creative: z
						.object({ mediaId: z.string(), altText: z.string() })
						.nullish(),
				}),
			)
			.mutation(async ({ ctx, input }) =>
				campaignDto(
					ensure(await updateCampaign(ctx.staff, input, adDeps)),
					adDeps.clock.now(),
				),
			),

		activate: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				campaignDto(
					ensure(await activateCampaign(ctx.staff, input, adDeps)),
					adDeps.clock.now(),
				),
			),

		pause: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) =>
				campaignDto(
					ensure(await pauseCampaign(ctx.staff, input, adDeps)),
					adDeps.clock.now(),
				),
			),

		remove: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				ensure(await deleteCampaign(ctx.staff, input, adDeps));
				return { id: input.id };
			}),

		/** Desempenho no período. Sem isto não há como responder "quantos cliques
		 * eu tive?" a quem paga pelo espaço. */
		stats: manage
			.input(
				z.object({
					campaignIds: z.array(z.string()),
					from: z.coerce.date(),
					to: z.coerce.date(),
				}),
			)
			.query(async ({ ctx, input }) =>
				ensure(await campaignStats(ctx.staff, input, adDeps)),
			),
	}),

	adsense: router({
		get: manage.query(async () => (await loadAdSenseSettings(adDeps)).data),

		update: manage
			.input(
				z.object({
					publisherId: z.string().nullish(),
					enabled: z.boolean().optional(),
					// Chaves como STRING livre, e não `z.record(z.enum(...))`: com chaves
					// de enum o zod 4 exige TODAS as posições presentes, e o formulário
					// manda só as preenchidas — o salvamento era recusado com um erro
					// de validação para cada posição em branco. Quem decide o que é
					// posição válida é o domínio, que itera `AD_SLOTS` e descarta o
					// resto (e o vazio) em `AdSenseSettings.change`.
					slotIds: z.record(z.string(), z.string()).optional(),
					nonPersonalized: z.boolean().optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const settings = ensure(
					await changeAdSenseSettings(ctx.staff, input, adDeps),
				);
				return settings.data;
			}),
	}),
});
