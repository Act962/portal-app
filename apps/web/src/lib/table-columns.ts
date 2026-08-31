/**
 * A ARITMÉTICA das colunas de uma tabela do painel — largura, limites e o
 * deslocamento das colunas congeladas. Sem JSX, sem React, sem DOM.
 *
 * Fica separado porque é a parte que erra CALADA. Uma largura fora do limite
 * não quebra o build nem o tipo: ela produz uma coluna de 12px que ninguém
 * consegue mais agarrar para desfazer, ou uma de 4000px que empurra o resto
 * para fora da tela. E o deslocamento das congeladas é pior ainda — se a soma
 * errar por um pixel, a segunda coluna cobre a primeira durante a rolagem, e
 * isso só aparece rolando, no navegador, com a janela num tamanho específico.
 *
 * O estado (largura de cada coluna) é do componente; as REGRAS são daqui.
 */

export type ColumnSpec = {
	key: string;
	/** Largura inicial, em px. */
	width: number;
	/** Abaixo disto a coluna fica inagarrável — o limite existe para o usuário
	 * conseguir DESFAZER o que acabou de fazer. */
	minWidth: number;
	/** Teto opcional. Sem ele, a coluna do título vira uma faixa de 4000px. */
	maxWidth?: number;
	/** Sem isto, a coluna não tem alça e ignora pedidos de redimensionamento. */
	resizable?: boolean;
	/** Congelada à esquerda. Só vale para as PRIMEIRAS colunas — ver `pinnedKeys`. */
	pinned?: boolean;
};

export type ColumnWidths = Readonly<Record<string, number>>;

/** Teto padrão: largo o bastante para uma manchete inteira, estreito o
 * bastante para não expulsar as demais colunas da tela. */
const DEFAULT_MAX_WIDTH = 720;

export function clampWidth(spec: ColumnSpec, width: number): number {
	// `NaN` entra por dois caminhos reais: `localStorage` adulterado e uma conta
	// de arrasto sobre um elemento que ainda não mediu. Cair no padrão é melhor
	// do que propagar `NaN` para o CSS, onde ele vira "largura automática" e a
	// tabela inteira se rearranja sozinha.
	if (!Number.isFinite(width)) {
		return spec.width;
	}
	const max = spec.maxWidth ?? DEFAULT_MAX_WIDTH;
	return Math.round(Math.min(Math.max(width, spec.minWidth), max));
}

/** As larguras de fábrica — o estado inicial e o alvo do "restaurar". */
export function defaultWidths(specs: readonly ColumnSpec[]): ColumnWidths {
	const widths: Record<string, number> = {};
	for (const spec of specs) {
		widths[spec.key] = clampWidth(spec, spec.width);
	}
	return widths;
}

/**
 * Aplica um redimensionamento. Devolve um objeto NOVO; coluna desconhecida ou
 * não redimensionável não muda nada — a tela não precisa saber disso de novo.
 */
export function resizeColumn(
	widths: ColumnWidths,
	specs: readonly ColumnSpec[],
	key: string,
	nextWidth: number,
): ColumnWidths {
	const spec = specs.find((s) => s.key === key);
	if (!spec?.resizable) {
		return widths;
	}
	const clamped = clampWidth(spec, nextWidth);
	if (widths[key] === clamped) {
		return widths;
	}
	return { ...widths, [key]: clamped };
}

/**
 * As colunas realmente congeladas: a SEQUÊNCIA INICIAL de `pinned`.
 *
 * Congelar uma coluna do meio não é "congelar a coluna do meio" — é abrir um
 * buraco: as colunas antes dela rolam por baixo, e ela pousa sobre a borda
 * esquerda cobrindo quem estivesse ali. Em vez de aceitar a configuração e
 * produzir esse defeito, a sequência é cortada no primeiro furo.
 */
export function pinnedKeys(specs: readonly ColumnSpec[]): readonly string[] {
	const keys: string[] = [];
	for (const spec of specs) {
		if (!spec.pinned) {
			break;
		}
		keys.push(spec.key);
	}
	return keys;
}

/**
 * O `left` de cada coluna congelada: a soma das que vêm antes dela.
 *
 * A primeira gruda em 0; a segunda, na largura da primeira. É esta soma que
 * mantém a coluna do título encostada na da caixinha em vez de por cima dela.
 */
export function pinnedOffsets(
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
): Readonly<Record<string, number>> {
	const offsets: Record<string, number> = {};
	let left = 0;
	for (const key of pinnedKeys(specs)) {
		offsets[key] = left;
		const spec = specs.find((s) => s.key === key);
		left += spec ? (widths[key] ?? spec.width) : 0;
	}
	return offsets;
}

/** A menor largura que a tabela pode ter sem espremer coluna nenhuma — vira o
 * `min-width` do `<table>`, e é o que faz a rolagem horizontal existir. */
export function tableMinWidth(
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
): number {
	return specs.reduce((sum, spec) => sum + (widths[spec.key] ?? spec.width), 0);
}

/**
 * Lê as larguras guardadas, com desconfiança.
 *
 * O que está no `localStorage` foi escrito por uma VERSÃO ANTERIOR desta tela:
 * coluna que não existe mais, largura abaixo de um mínimo que subiu depois,
 * lixo de alguém que editou à mão. Nada disso pode virar layout quebrado — o
 * desconhecido é descartado e o conhecido passa pelo mesmo limite de sempre.
 */
export function readStoredWidths(
	raw: string | null,
	specs: readonly ColumnSpec[],
): ColumnWidths {
	const widths = { ...defaultWidths(specs) } as Record<string, number>;
	if (!raw) {
		return widths;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return widths;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return widths;
	}
	for (const spec of specs) {
		// Só o que é redimensionável se guarda: a largura de uma coluna fixa é
		// decisão do código, e restaurá-la do disco recriaria um layout que a
		// versão nova já corrigiu.
		if (!spec.resizable) {
			continue;
		}
		const stored = (parsed as Record<string, unknown>)[spec.key];
		if (typeof stored === "number") {
			widths[spec.key] = clampWidth(spec, stored);
		}
	}
	return widths;
}

/** Guarda só o que é redimensionável — ver `readStoredWidths`. */
export function serializeWidths(
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
): string {
	const saved: Record<string, number> = {};
	for (const spec of specs) {
		if (spec.resizable) {
			saved[spec.key] = widths[spec.key] ?? spec.width;
		}
	}
	return JSON.stringify(saved);
}

/** Alguma coluna saiu do padrão? É o que decide se o botão "restaurar
 * larguras" tem o que fazer — oferecê-lo sempre é oferecer um clique inerte. */
export function hasCustomWidths(
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
): boolean {
	const defaults = defaultWidths(specs);
	return specs.some((spec) => widths[spec.key] !== defaults[spec.key]);
}

/**
 * A ORDEM DE EMPILHAMENTO da tabela.
 *
 * Mora aqui, e não no componente, porque é uma REGRA e não um estilo — e
 * porque já foi quebrada: a alça de arrasto e o cabeçalho congelado ficaram
 * ambos em `z-20`, e empate de `z-index` não é empate: quem ganha é o último
 * no DOM. A alça de uma coluna que já tinha rolado para fora da vista aparecia
 * como uma listra vertical no meio do cabeçalho congelado.
 *
 * As classes são LITERAIS de propósito: o Tailwind lê o código-fonte para
 * decidir o que gerar, e um `z-${n}` montado em tempo de execução não existiria
 * na folha de estilo final.
 */
export const STACK = {
	/** Célula congelada do corpo — acima das células que rolam por baixo. */
	pinnedCell: "z-10",
	/** Alça de arrasto — acima do cabeçalho comum, abaixo do congelado. */
	resizeHandle: "z-20",
	/** Cabeçalho congelado — acima de tudo o que passa por baixo dele. */
	pinnedHeader: "z-30",
} as const;

/** O número dentro da classe, para a invariante da ordem ser verificável. */
export function stackLevel(token: string): number {
	return Number(token.replace("z-", ""));
}
