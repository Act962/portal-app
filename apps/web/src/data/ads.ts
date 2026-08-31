import "server-only";

import {
	AdSenseSettings,
	type AdSlot,
	candidatesForSlot,
	loadAdSenseSettings,
} from "@portal-app/advertising";
import { adDeps } from "@portal-app/api/advertising";
import prisma from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { cache } from "react";

/**
 * A leitura de publicidade do PORTAL. RSC, sem tRPC — o grupo `(site)` é 100%
 * servidor (regra do CLAUDE.md).
 *
 * Passa pelo CASO DE USO (`candidatesForSlot`) e não direto no Prisma, ao
 * contrário do resto do read model. A diferença é que aqui existe REGRA: quem
 * decide se uma campanha está no ar, e se a segmentada tem prioridade sobre a
 * global, é o domínio. Reescrever esse filtro numa consulta SQL criaria uma
 * segunda versão da regra — e é sempre a segunda que erra primeiro. É também o
 * que a arquitetura manda: `apps/web` não importa `infrastructure/` de contexto
 * nenhum (regra `infra-nao-vaza`), então a instância vem da raiz de composição.
 *
 * E devolve a LISTA de candidatas, não a vencedora. O portal é servido de cache
 * (`revalidate = 60`), então sortear aqui congelaria o resultado junto com o
 * HTML: todo mundo veria a mesma campanha por um minuto, e o rodízio deixaria
 * de existir. Quem sorteia é o navegador, uma vez por carregamento.
 */

export type ServableAd = {
	id: string;
	advertiser: string;
	destinationUrl: string;
	imageUrl: string;
	altText: string;
	weight: number;
	width: number | null;
	height: number | null;
};

export type SlotContent = {
	campaigns: ServableAd[];
	adsense: {
		publisherId: string;
		slotId: string;
		nonPersonalized: boolean;
	} | null;
};

const EMPTY: SlotContent = { campaigns: [], adsense: null };

/** Tolerante a banco fora do ar, como o resto do read model (N03): sem
 * publicidade o portal continua sendo um portal. */
async function safely<T>(what: string, run: () => Promise<T>, fallback: T) {
	try {
		return await run();
	} catch (error) {
		console.warn(`[ads] leitura "${what}" falhou; sem anúncio:`, error);
		return fallback;
	}
}

const PUBLIC_BASE = env.S3_PUBLIC_URL.replace(/\/+$/, "");

/**
 * As artes das campanhas ATIVAS, por id.
 *
 * Duas consultas pequenas em vez de uma com join: a capa é uma COLUNA em
 * `ad_campaign` (`coverMediaId`), não uma relação — de propósito, para o
 * contexto de publicidade não depender do de mídia (regra `contextos-isolados`).
 * O preço de não ter a relação se paga aqui, uma vez por render, com o
 * `cache()` fazendo as quatro posições de uma home dividirem o mesmo resultado.
 */
const loadCreatives = cache(
	async (): Promise<
		Map<string, { url: string; width: number | null; height: number | null }>
	> => {
		const ids = await safely(
			"artes das campanhas",
			async () => {
				const rows = await prisma.adCampaign.findMany({
					where: { status: "ATIVA", coverMediaId: { not: null } },
					select: { coverMediaId: true },
				});
				return rows
					.map((row) => row.coverMediaId)
					.filter((id): id is string => id !== null);
			},
			[] as string[],
		);
		if (ids.length === 0) {
			return new Map();
		}
		const rows = await safely(
			"artes",
			() =>
				prisma.mediaAsset.findMany({
					where: { id: { in: ids } },
					select: { id: true, storageKey: true, width: true, height: true },
				}),
			[] as {
				id: string;
				storageKey: string;
				width: number | null;
				height: number | null;
			}[],
		);
		return new Map(
			rows.map((row) => [
				row.id,
				{
					url: `${PUBLIC_BASE}/${row.storageKey}`,
					width: row.width,
					height: row.height,
				},
			]),
		);
	},
);

/**
 * O que servir numa posição desta página.
 *
 * `sectionId` é `null` na home, na busca e na página de autor — lugares que não
 * pertencem a editoria nenhuma. Não é omissão: é a informação de que uma
 * campanha segmentada NÃO deve aparecer ali, porque não foi isso que se vendeu.
 */
export const getSlotContent = cache(async function getSlotContent(
	slot: AdSlot,
	sectionId: string | null,
): Promise<SlotContent> {
	return safely(
		`posição ${slot}`,
		async () => {
			const [{ campaigns, adsenseEnabled }, settings, creatives] =
				await Promise.all([
					candidatesForSlot({ slot, sectionId }, adDeps),
					loadAdSense(),
					loadCreatives(),
				]);

			const servable = campaigns.flatMap((campaign): ServableAd[] => {
				const creative = campaign.creative;
				const art = creative ? creatives.get(creative.mediaId) : undefined;
				// Campanha cuja arte sumiu da biblioteca não vira caixa quebrada: sai
				// da lista, e o AdSense (ou o vazio) assume o espaço.
				if (!creative || !art) {
					return [];
				}
				return [
					{
						id: campaign.id,
						advertiser: campaign.advertiser,
						destinationUrl: campaign.destination.value,
						imageUrl: art.url,
						altText: creative.altText,
						weight: campaign.weight,
						width: art.width,
						height: art.height,
					},
				];
			});

			const slotId = settings.data.slotIds[slot];
			return {
				campaigns: servable,
				adsense:
					adsenseEnabled && settings.data.publisherId && slotId
						? {
								publisherId: settings.data.publisherId,
								slotId,
								nonPersonalized: settings.data.nonPersonalized,
							}
						: null,
			};
		},
		EMPTY,
	);
});

/**
 * Há algo para servir nesta posição?
 *
 * Existe para quem precisa decidir a MOLDURA antes de renderizar o anúncio —
 * hoje a âncora do celular, que é uma barra fixa com botão de fechar: sem
 * anúncio, a barra inteira não deve existir, e não só o miolo dela. O
 * `cache()` do React faz esta pergunta e o `AdPlacement` seguinte dividirem a
 * MESMA leitura, então não custa consulta a mais.
 */
export async function hasAdFor(
	slot: AdSlot,
	sectionId: string | null,
): Promise<boolean> {
	const { campaigns, adsense } = await getSlotContent(slot, sectionId);
	return campaigns.length > 0 || adsense !== null;
}

/** A configuração do AdSense, para o `<head>` e para o `/ads.txt`. */
export const loadAdSense = cache(async () =>
	safely<Awaited<ReturnType<typeof loadAdSenseSettings>> | null>(
		"adsense",
		() => loadAdSenseSettings(adDeps),
		null,
	).then((settings) => settings ?? AdSenseSettings.restore(null)),
);

/** Só o que o `<head>` precisa saber: carregar ou não o script do Google. */
export async function getAdSenseScript(): Promise<{
	publisherId: string;
} | null> {
	const settings = await loadAdSense();
	if (!settings.data.enabled || !settings.data.publisherId) {
		return null;
	}
	return { publisherId: settings.data.publisherId };
}
