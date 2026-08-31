import type { EditorialStatus } from "@portal-app/editorial";

/**
 * As regras do SELETOR da lista de matérias — sem JSX, sem React, sem tRPC.
 *
 * A tela só marca caixinha e desenha barra; quem responde "esta pode ser
 * arquivada?", "marcar tudo marca o quê?" e "o que dizer depois" é este módulo.
 * Fica separado porque é exatamente a parte que erra em silêncio: um
 * "selecionar tudo" que inclui o que não dá para arquivar produz um lote que
 * falha pela metade, e isso não se vê olhando a tela — se vê rodando o teste.
 */

/**
 * Só matéria no ar pode ser arquivada — é o que o agregado `Article` permite
 * (`PUBLICADA`/`ATUALIZADA` → `ARQUIVADA`). A tela repete a regra para não
 * OFERECER o que o domínio vai recusar; a regra continua sendo do domínio, e
 * é ele quem decide de verdade no servidor.
 */
export function isArchivable(status: EditorialStatus): boolean {
	return status === "PUBLICADA" || status === "ATUALIZADA";
}

type Selectable = { id: string; status: EditorialStatus };

/** Os ids da página que o seletor pode marcar. */
export function archivableIds(
	articles: readonly Selectable[],
): readonly string[] {
	return articles.filter((a) => isArchivable(a.status)).map((a) => a.id);
}

/** Marca/desmarca um id, devolvendo um conjunto NOVO (o estado é imutável). */
export function toggleSelection(
	selected: ReadonlySet<string>,
	id: string,
): Set<string> {
	const next = new Set(selected);
	if (!next.delete(id)) {
		next.add(id);
	}
	return next;
}

/**
 * A caixinha do cabeçalho: marcada, indeterminada ou vazia — contando apenas o
 * que é marcável NESTA página. Sem nada marcável, ela fica vazia (e a tela a
 * desabilita); "marcado" com zero itens diria que há uma seleção que não há.
 */
export function headerCheckboxState(
	articles: readonly Selectable[],
	selected: ReadonlySet<string>,
): "checked" | "indeterminate" | "unchecked" {
	const ids = archivableIds(articles);
	if (ids.length === 0) {
		return "unchecked";
	}
	const marked = ids.filter((id) => selected.has(id)).length;
	if (marked === 0) {
		return "unchecked";
	}
	return marked === ids.length ? "checked" : "indeterminate";
}

/**
 * O clique no cabeçalho. Marca tudo o que é marcável na página, ou desmarca só
 * o que veio dela — a seleção feita em OUTRA página não é desfeita por um
 * "desmarcar tudo" que o usuário deu aqui, porque não é isso que ele vê
 * acontecer.
 */
export function toggleAll(
	articles: readonly Selectable[],
	selected: ReadonlySet<string>,
): Set<string> {
	const ids = archivableIds(articles);
	const next = new Set(selected);
	if (headerCheckboxState(articles, selected) === "checked") {
		for (const id of ids) {
			next.delete(id);
		}
		return next;
	}
	for (const id of ids) {
		next.add(id);
	}
	return next;
}

/**
 * Tira da seleção o que sumiu da lista — o filtro mudou, a página virou, o
 * lote foi arquivado. Sem isto a barra continuaria dizendo "3 selecionadas"
 * sobre matérias que ninguém mais vê, e o botão arquivaria às cegas.
 */
export function pruneSelection(
	selected: ReadonlySet<string>,
	visibleIds: readonly string[],
): Set<string> {
	const visible = new Set(visibleIds);
	return new Set([...selected].filter((id) => visible.has(id)));
}

/** Plural correto na barra e no diálogo. "1 matéria", "3 matérias". */
export function countLabel(count: number): string {
	return count === 1 ? "1 matéria" : `${count} matérias`;
}

/**
 * O aviso do fim do lote. Existe para não haver duas versões da frase — uma no
 * sucesso e outra no erro — que discordem sobre o que aconteceu.
 */
export function archiveResultMessage(outcome: {
	archived: readonly string[];
	failed: readonly { id: string; reason: string }[];
}): { tone: "success" | "warning" | "error"; message: string } {
	const done = outcome.archived.length;
	const failed = outcome.failed.length;
	if (failed === 0) {
		return {
			tone: "success",
			message: `${countLabel(done)} arquivada${done === 1 ? "" : "s"}.`,
		};
	}
	if (done === 0) {
		return {
			tone: "error",
			message:
				failed === 1
					? `Não foi possível arquivar: ${outcome.failed[0]?.reason}`
					: `Nenhuma das ${failed} matérias pôde ser arquivada.`,
		};
	}
	return {
		tone: "warning",
		message: `${countLabel(done)} arquivada${done === 1 ? "" : "s"}; ${failed} não pôde${failed === 1 ? "" : "ram"} ser arquivada${failed === 1 ? "" : "s"}.`,
	};
}
