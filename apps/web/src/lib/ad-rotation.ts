/**
 * O SORTEIO do rodízio, do lado do navegador — sem React e sem DOM.
 *
 * A regra de quem PODE aparecer é do domínio (`eligibleCampaigns`, no contexto
 * de publicidade) e já foi aplicada no servidor. O que sobrou para cá é só
 * escolher uma da lista respeitando o peso, e essa parte precisa rodar no
 * cliente por causa do cache: o portal é servido com `revalidate = 60`, então
 * um sorteio feito no servidor ficaria congelado dentro do HTML e todo mundo
 * veria a mesma campanha durante um minuto inteiro.
 *
 * O acaso entra por PARÂMETRO, como no domínio. É o que permite provar a
 * proporção do rodízio em vez de rodar mil vezes e torcer.
 */

export type Weighted = { id: string; weight: number };

/**
 * Escolhe pelo peso. `roll` é [0,1).
 *
 * Repete deliberadamente a mesma matemática do `pickWeighted` do domínio — não
 * é duplicação por descuido: aquele opera sobre o agregado `Campaign`, que não
 * atravessa a fronteira servidor→cliente, e importar o contexto inteiro num
 * componente de navegador arrastaria Prisma junto. As duas versões têm testes
 * próprios, e o que as mantém honestas é a mesma tabela de casos-limite.
 */
export function pickByWeight<T extends Weighted>(
	items: readonly T[],
	roll: number,
): T | null {
	if (items.length === 0) {
		return null;
	}
	const total = items.reduce((sum, item) => sum + Math.max(item.weight, 0), 0);
	if (total <= 0) {
		// Todos com peso zero: sem faixa para sortear, devolve o primeiro em vez
		// de `null` — `null` deixaria o espaço vendido vazio.
		return items[0] ?? null;
	}
	const safeRoll = Number.isFinite(roll)
		? Math.min(Math.max(roll, 0), 0.999999)
		: 0;
	const target = safeRoll * total;

	let cumulative = 0;
	for (const item of items) {
		cumulative += Math.max(item.weight, 0);
		if (target < cumulative) {
			return item;
		}
	}
	/* v8 ignore next 2 -- inalcançável: o roll preso abaixo de 1 sempre cai numa faixa */
	return items[items.length - 1] ?? null;
}
