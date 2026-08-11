/**
 * A escala do eixo Y dos gráficos de Insights.
 *
 * Mora fora do componente porque é regra pura — sem JSX, sem React, sem
 * relógio — e porque foi justamente aqui que nasceu um defeito que só aparecia
 * em portal recém-instalado (ver o teste).
 */

/**
 * Três marcas: base, meio e topo. Mais que isso vira grade densa.
 *
 * DEDUPLICA de propósito. Com `max = 1` — o piso de um período inteiro sem
 * visualização, que é o estado de um portal recém-instalado — as três marcas
 * seriam `[0, 1, 1]`: `Math.round(0.5)` arredonda para cima e o meio encosta no
 * topo. Como cada marca vira um `<g key={tick}>`, a chave repetida faz o React
 * omitir um dos nós, e o eixo perde uma marca em silêncio.
 *
 * Vale para qualquer `max` pequeno, não só o zerado: `max = 1` colide o meio
 * com o topo. De `max = 2` em diante as três são distintas.
 */
export function yAxisTicks(max: number): number[] {
	return [...new Set([0, Math.round(max / 2), max])];
}
