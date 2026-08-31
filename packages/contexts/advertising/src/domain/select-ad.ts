import type { AdSlot } from "./ad-slot";
import type { Campaign } from "./campaign";

/**
 * A REGRA DE VEICULAÇÃO: dada uma posição, uma página e um instante, o que
 * aparece ali?
 *
 * É função pura de ponta a ponta — inclusive o sorteio. O acaso entra por
 * PARÂMETRO (`roll`, um número em [0,1)), e não por `Math.random()` dentro:
 * sorteio embutido é a diferença entre um teste que prova a proporção do
 * rodízio e um teste que roda mil vezes e torce.
 */

export type AdDecision =
	/** Uma campanha da casa venceu o rodízio. */
	| { kind: "campanha"; campaign: Campaign }
	/** Não há campanha para esta posição — o AdSense preenche. */
	| { kind: "adsense" }
	/** Nada a servir: sem campanha e sem AdSense configurado. */
	| { kind: "vazio" };

export type PlacementContext = {
	slot: AdSlot;
	/** A editoria da página. `null` na home, na busca, no autor — lugares que
	 * não pertencem a uma editoria. */
	sectionId: string | null;
	now: Date;
};

/**
 * As campanhas que PODEM aparecer aqui, com a prioridade da segmentação já
 * aplicada.
 *
 * Campanha segmentada GANHA da global. Não é detalhe técnico, é o contrato:
 * quem comprou "só em Esportes" comprou justamente aquele espaço naquela
 * editoria, e deixá-la disputar no peso com uma campanha global de peso 10
 * faria a segmentada aparecer uma vez a cada onze — vendida, paga e invisível.
 * A global continua valendo onde nenhuma segmentada alcança, que é o papel
 * dela: preencher o resto do portal.
 */
export function eligibleCampaigns(
	campaigns: readonly Campaign[],
	context: PlacementContext,
): readonly Campaign[] {
	const live = campaigns.filter(
		(campaign) =>
			campaign.slot === context.slot &&
			campaign.isLiveAt(context.now) &&
			campaign.servesSection(context.sectionId),
	);

	const targeted = live.filter((campaign) => !campaign.isGlobal);
	return targeted.length > 0 ? targeted : live;
}

/**
 * O sorteio por peso. `roll` é [0,1) — quem o produz é a borda (o cliente, uma
 * vez por carregamento), não esta função.
 *
 * Peso 3 contra peso 1 significa que a primeira ocupa 3/4 da faixa [0,1). A
 * ordem da lista importa para a REPRODUTIBILIDADE do teste, então quem chama
 * deve mandar uma lista com ordem estável (o repositório ordena por id).
 */
export function pickWeighted(
	campaigns: readonly Campaign[],
	roll: number,
): Campaign | null {
	if (campaigns.length === 0) {
		return null;
	}
	const total = campaigns.reduce((sum, campaign) => sum + campaign.weight, 0);
	/* v8 ignore next 3 -- peso mínimo é 1, então o total só seria 0 com lista vazia */
	if (total <= 0) {
		return campaigns[0] ?? null;
	}

	// Um `roll` fora da faixa vem de erro de quem chama, não de dado do usuário.
	// Prender no intervalo devolve uma campanha válida em vez de `null`, que a
	// tela leria como "não há anúncio" e deixaria o espaço vazio sem motivo.
	const safeRoll = Number.isFinite(roll)
		? Math.min(Math.max(roll, 0), 0.999999)
		: 0;
	const target = safeRoll * total;

	let cumulative = 0;
	for (const campaign of campaigns) {
		cumulative += campaign.weight;
		if (target < cumulative) {
			return campaign;
		}
	}
	/* v8 ignore next 2 -- inalcançável: o `roll` preso abaixo de 1 sempre cai numa faixa */
	return campaigns[campaigns.length - 1] ?? null;
}

/**
 * A decisão completa: campanha da casa, AdSense, ou nada.
 *
 * A ORDEM é a que o cliente escolheu e é a que faz sentido comercial: venda
 * direta primeiro, AdSense preenchendo a sobra. O espaço vendido diretamente
 * paga muito mais que o programático, então deixá-lo ser tomado pelo AdSense
 * seria trocar receita por receita menor. E o inverso — reservar o espaço para
 * a casa e deixá-lo vazio quando não há campanha — é desperdiçar inventário.
 */
export function decideAd(
	campaigns: readonly Campaign[],
	context: PlacementContext & { roll: number; adsenseEnabled: boolean },
): AdDecision {
	const eligible = eligibleCampaigns(campaigns, context);
	const winner = pickWeighted(eligible, context.roll);
	if (winner) {
		return { kind: "campanha", campaign: winner };
	}
	return context.adsenseEnabled ? { kind: "adsense" } : { kind: "vazio" };
}
