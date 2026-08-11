import { describe, expect, it } from "vitest";

import { yAxisTicks } from "@/components/admin/insights/scale";

/**
 * O defeito que originou este arquivo apareceu no aceite visual, num portal
 * recém-instalado: o eixo Y do gráfico de visualizações mostrava só duas
 * marcas, e o console acusava `two children with the same key`.
 *
 * A causa era aritmética, não de renderização — `[0, Math.round(1 / 2), 1]` é
 * `[0, 1, 1]`. Por isso a regra saiu do componente: assim ela se prova sem
 * montar SVG nenhum.
 */
describe("yAxisTicks", () => {
	it("não repete marca quando o topo é 1 (portal sem visualização nenhuma)", () => {
		// O caso que quebrou: `Math.round(0.5)` sobe para 1 e encosta no topo.
		expect(yAxisTicks(1)).toEqual([0, 1]);
	});

	it("dá base, meio e topo quando há folga para os três", () => {
		expect(yAxisTicks(100)).toEqual([0, 50, 100]);
	});

	it("passa a distinguir as três a partir de 2", () => {
		// A fronteira: 2 é o menor topo em que o meio não colide com ninguém.
		expect(yAxisTicks(2)).toEqual([0, 1, 2]);
	});

	it("arredonda o meio para inteiro — marca de eixo com decimal não se lê", () => {
		expect(yAxisTicks(7)).toEqual([0, 4, 7]);
	});

	it("devolve marcas únicas em qualquer topo, que é o contrato da chave do React", () => {
		for (let max = 1; max <= 200; max++) {
			const ticks = yAxisTicks(max);
			expect(new Set(ticks).size).toBe(ticks.length);
		}
	});
});
