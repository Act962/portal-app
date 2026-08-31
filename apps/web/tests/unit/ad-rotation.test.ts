import { describe, expect, it } from "vitest";

import { pickByWeight } from "@/lib/ad-rotation";

/**
 * O sorteio do rodízio no CLIENTE. Espelha a tabela de casos-limite do
 * `pickWeighted` do domínio de propósito: são duas implementações (o agregado
 * `Campaign` não atravessa a fronteira servidor→cliente), e o que as mantém
 * honestas uma com a outra é responderem aos mesmos casos.
 */

const ad = (id: string, weight = 1) => ({ id, weight });

describe("pickByWeight", () => {
	it("lista vazia não escolhe nada", () => {
		expect(pickByWeight([], 0.5)).toBeNull();
	});

	it("um só item vence sempre", () => {
		for (const roll of [0, 0.5, 0.999]) {
			expect(pickByWeight([ad("a")], roll)?.id).toBe("a");
		}
	});

	it("pesos iguais dividem a faixa ao meio, fronteira para o segundo", () => {
		const lista = [ad("a"), ad("b")];
		expect(pickByWeight(lista, 0.49)?.id).toBe("a");
		expect(pickByWeight(lista, 0.5)?.id).toBe("b");
	});

	it("peso 3 contra 1 ocupa três quartos", () => {
		const lista = [ad("grande", 3), ad("pequena")];
		expect(pickByWeight(lista, 0.74)?.id).toBe("grande");
		expect(pickByWeight(lista, 0.75)?.id).toBe("pequena");
	});

	it("a proporção se confirma varrendo a faixa inteira", () => {
		const lista = [ad("grande", 3), ad("pequena")];
		const contagem: Record<string, number> = { grande: 0, pequena: 0 };
		for (let i = 0; i < 1000; i++) {
			const vencedora = pickByWeight(lista, i / 1000);
			contagem[vencedora?.id as string] += 1;
		}
		expect(contagem).toEqual({ grande: 750, pequena: 250 });
	});

	it("sorteio fora da faixa prende no intervalo, e não devolve nulo", () => {
		// `null` deixaria vazio um espaço vendido, por causa de um erro de quem
		// chamou — o pior desfecho possível para o anunciante.
		const lista = [ad("a"), ad("b")];
		expect(pickByWeight(lista, -1)?.id).toBe("a");
		expect(pickByWeight(lista, 2)?.id).toBe("b");
		expect(pickByWeight(lista, Number.NaN)?.id).toBe("a");
	});

	it("todos com peso zero ainda devolvem alguém", () => {
		expect(pickByWeight([ad("a", 0), ad("b", 0)], 0.5)?.id).toBe("a");
	});
});
