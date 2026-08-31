import { AD_SLOTS } from "@portal-app/advertising";
import { AD_FORMATS } from "@portal-app/ui/components/ad-slot";
import { describe, expect, it } from "vitest";

/**
 * O GUARDA das duas listas de posições.
 *
 * `AD_SLOTS` (domínio) diz quais posições existem para vender; `AD_FORMATS`
 * (packages/ui) diz a altura e a legenda de cada caixa. As duas não podem se
 * importar — o contexto não conhece React e o `packages/ui` não pode consultar
 * banco —, e este arquivo é o único lugar do repositório que enxerga as duas.
 *
 * Sem ele, o erro é MUDO nos dois sentidos: um formato só na UI vira uma caixa
 * que nunca serve anúncio; um só no domínio vira uma campanha que nunca
 * aparece. Nenhum dos dois quebra build, tipo ou teste — só deixa um espaço
 * vazio que alguém descobre semanas depois, olhando o portal.
 */
describe("posições de anúncio", () => {
	it("o domínio e a UI conhecem exatamente as mesmas posições", () => {
		expect([...AD_SLOTS].sort()).toEqual(Object.keys(AD_FORMATS).sort());
	});

	it("toda posição reserva ALTURA — é o que mantém o CLS em zero", () => {
		for (const slot of AD_SLOTS) {
			const format = AD_FORMATS[slot];
			expect(format.height).toBeGreaterThan(0);
		}
	});
});
