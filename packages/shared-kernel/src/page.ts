/**
 * Paginação por OFFSET, para as listas do painel.
 *
 * Offset e não cursor, de propósito. Cursor é melhor para rolagem infinita e
 * para tabela enorme, mas não sabe dizer "página 7 de 12" nem pular para a
 * última — e é isso que uma tela de administração precisa: o editor quer ir ao
 * fim do arquivo, não rolar até lá. O portal público é outra conversa, e está
 * registrada como P12 em `docs/pendencias.md`.
 *
 * Mora no shared-kernel porque três contextos diferentes (editorial, media,
 * auditoria) paginam. Sem um lugar comum, cada um inventaria o seu, com nomes e
 * limites ligeiramente diferentes.
 */
export type PageRequest = {
	/** Quantos itens trazer. Já normalizado — ver `toPageRequest`. */
	limit: number;
	/** Quantos pular. Já normalizado. */
	offset: number;
};

export type Page<T> = {
	items: T[];
	/** Total de itens que satisfazem o filtro, ignorando a paginação. */
	total: number;
};

export const DEFAULT_PAGE_SIZE = 20;
/**
 * Teto por requisição. Existe porque o `limit` chega pela rede: sem ele, um
 * `?perPage=1000000` transforma a lista do painel num pedido de despejo do
 * banco inteiro — de graça, para qualquer pessoa autenticada.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Normaliza o que chegou de fora num `PageRequest` seguro.
 *
 * Aceita página 1-based (é o que a URL e a UI usam) e devolve offset 0-based (é
 * o que o banco usa) — a conversão fica AQUI, num lugar só, porque errar o
 * `-1` é o clássico desta função.
 */
export function toPageRequest(input?: {
	page?: number;
	perPage?: number;
}): PageRequest {
	const perPage = clampInteger(
		input?.perPage ?? DEFAULT_PAGE_SIZE,
		1,
		MAX_PAGE_SIZE,
		DEFAULT_PAGE_SIZE,
	);
	// Sem teto superior: pedir uma página além do fim devolve lista vazia, que é
	// resposta honesta. Travar no total exigiria consultar o total antes.
	const page = clampInteger(input?.page ?? 1, 1, Number.MAX_SAFE_INTEGER, 1);

	return { limit: perPage, offset: (page - 1) * perPage };
}

/** Quantas páginas o total dá, para a UI desenhar "de N". Zero itens = 1 página. */
export function pageCount(total: number, perPage: number): number {
	if (perPage <= 0) {
		return 1;
	}
	return Math.max(1, Math.ceil(total / perPage));
}

function clampInteger(
	value: number,
	min: number,
	max: number,
	fallback: number,
): number {
	if (!Number.isFinite(value) || !Number.isInteger(value)) {
		return fallback;
	}
	return Math.min(Math.max(value, min), max);
}
