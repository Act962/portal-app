import type { EditorialStatus } from "@portal-app/editorial";

/**
 * As regras do SELETOR da lista de matérias — sem JSX, sem React, sem tRPC.
 *
 * A tela só marca caixinha e desenha barra; quem responde "esta pode ser
 * arquivada?", "quantas da seleção o botão apagar vai realmente pegar?" e "o
 * que dizer depois" é este módulo. Fica separado porque é exatamente a parte
 * que erra em silêncio: um "selecionar tudo" que inclui o que a ação não
 * alcança produz um lote que falha pela metade, e isso não se vê olhando a tela
 * — se vê rodando o teste.
 */

/** As duas ações em lote da lista. */
export type BulkAction = "archive" | "delete";

/**
 * Arquivar vale de QUALQUER estado, menos do próprio arquivo — é o que o
 * agregado `Article` permite desde que `archive` deixou de exigir matéria no
 * ar. Rascunho abandonado e pauta morta na revisão saem de circulação por aqui.
 */
export function canArchive(status: EditorialStatus): boolean {
	return status !== "ARQUIVADA";
}

/**
 * Apagar vale para tudo, MENOS o que está no ar.
 *
 * A matéria publicada tem endereço indexado e linkado por fora; sumir com ela
 * de um clique transforma tudo isso em 404. Quem quer eliminá-la mesmo assim
 * arquiva primeiro — e essa parada no meio do caminho é a chance de mudar de
 * ideia. Quem decide de verdade é o agregado (`markDeleted`); a tela repete a
 * regra para não OFERECER o que o servidor vai recusar.
 */
export function canDelete(status: EditorialStatus): boolean {
	return status !== "PUBLICADA" && status !== "ATUALIZADA";
}

export function allows(status: EditorialStatus, action: BulkAction): boolean {
	return action === "archive" ? canArchive(status) : canDelete(status);
}

type Selectable = {
	id: string;
	status: EditorialStatus;
	/** Nulo = nunca esteve no ar. Decide a força da confirmação de apagar. */
	firstPublishedAt?: Date | string | null;
};

/** Da seleção, os ids que ESTA ação alcança. */
export function eligibleIds(
	articles: readonly Selectable[],
	selected: ReadonlySet<string>,
	action: BulkAction,
): string[] {
	return articles
		.filter((a) => selected.has(a.id) && allows(a.status, action))
		.map((a) => a.id);
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
 * A caixinha do cabeçalho: marcada, indeterminada ou vazia.
 *
 * Conta TODAS as linhas da página, e não as de uma ação específica. Antes
 * contava só as arquiváveis, porque arquivar era a única coisa que a barra
 * fazia; com duas ações, cada linha serve a pelo menos uma delas (o teste em
 * `article-selection.test.ts` percorre os status e prova isso), e uma caixinha
 * amarrada a uma das duas mentiria sobre a outra.
 */
export function headerCheckboxState(
	articles: readonly Selectable[],
	selected: ReadonlySet<string>,
): "checked" | "indeterminate" | "unchecked" {
	if (articles.length === 0) {
		return "unchecked";
	}
	const marked = articles.filter((a) => selected.has(a.id)).length;
	if (marked === 0) {
		return "unchecked";
	}
	return marked === articles.length ? "checked" : "indeterminate";
}

/**
 * O clique no cabeçalho. Marca a página inteira, ou desmarca só o que veio dela
 * — a seleção feita em OUTRA página não é desfeita por um "desmarcar tudo" que
 * o usuário deu aqui, porque não é isso que ele vê acontecer.
 */
export function toggleAll(
	articles: readonly Selectable[],
	selected: ReadonlySet<string>,
): Set<string> {
	const next = new Set(selected);
	const checked = headerCheckboxState(articles, selected) === "checked";
	for (const article of articles) {
		if (checked) {
			next.delete(article.id);
		} else {
			next.add(article.id);
		}
	}
	return next;
}

/**
 * Tira da seleção o que sumiu da lista — o filtro mudou, a página virou, o
 * lote foi arquivado. Sem isto a barra continuaria dizendo "3 selecionadas"
 * sobre matérias que ninguém mais vê, e o botão agiria às cegas.
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

// --- Confirmação de apagar ---------------------------------------------------

/** A palavra que destrava o apagamento. */
export const DELETE_CONFIRMATION = "APAGAR";

/**
 * Aceita minúscula e espaço sobrando de propósito. O que a digitação compra é
 * DELIBERAÇÃO — obrigar a pessoa a parar e declarar o que vai fazer. Recusar
 * "apagar " por causa de um espaço não acrescenta cuidado nenhum: só transforma
 * uma trava de segurança em um jogo de acertar a grafia, e quem erra duas vezes
 * passa a colar o texto sem ler.
 */
export function isDeleteConfirmed(typed: string): boolean {
	return typed.trim().toUpperCase() === DELETE_CONFIRMATION;
}

/**
 * Quando exigir a palavra digitada.
 *
 * NÃO é sempre — e essa é a decisão de projeto aqui. Confirmação que aparece em
 * toda ação vira reflexo: a pessoa digita APAGAR sem ler, e aí a trava não
 * protege mais nada justamente na vez em que importava. Então ela fica
 * reservada aos dois casos em que o estrago é grande:
 *
 * - alguma das matérias JÁ ESTEVE NO AR — apagá-la destrói um endereço público,
 *   que continua indexado no Google e colado em conversa de WhatsApp;
 * - é mais de uma de uma vez — o erro de mira do lote não se desfaz.
 *
 * Um rascunho solto que nunca saiu do painel não passa por isso: uma
 * confirmação normal basta, e cobrar mais só ensinaria a ignorá-la.
 */
export function requiresTypedConfirmation(
	targets: readonly Selectable[],
): boolean {
	if (targets.length > 1) {
		return true;
	}
	return targets.some((a) => a.firstPublishedAt != null);
}

// --- Mensagens ---------------------------------------------------------------

const VERBS = {
	archive: { infinitive: "arquivar", one: "arquivada", many: "arquivadas" },
	delete: { infinitive: "apagar", one: "apagada", many: "apagadas" },
} as const;

/**
 * O aviso do fim do lote. Uma função para as duas ações: duas versões da frase
 * — uma para arquivar, outra para apagar — acabariam discordando sobre o que
 * contar quando o lote passa pela metade.
 */
export function bulkResultMessage(
	outcome: {
		done: readonly string[];
		failed: readonly { id: string; reason: string }[];
	},
	action: BulkAction,
): { tone: "success" | "warning" | "error"; message: string } {
	const verb = VERBS[action];
	const done = outcome.done.length;
	const failed = outcome.failed.length;
	const participle = (n: number) => (n === 1 ? verb.one : verb.many);

	if (failed === 0) {
		return {
			tone: "success",
			message: `${countLabel(done)} ${participle(done)}.`,
		};
	}
	if (done === 0) {
		return {
			tone: "error",
			message:
				failed === 1
					? `Não foi possível ${verb.infinitive}: ${outcome.failed[0]?.reason}`
					: `Nenhuma das ${failed} matérias pôde ser ${verb.one}.`,
		};
	}
	// "não pôde" / "não puderam" — a conjugação inteira, não um sufixo colado.
	// Concatenar "ram" no fim de "pôde" produzia "pôderam", que não é palavra.
	const couldNot = failed === 1 ? "não pôde" : "não puderam";
	return {
		tone: "warning",
		message: `${countLabel(done)} ${participle(done)}; ${failed} ${couldNot} ser ${participle(failed)}.`,
	};
}

/**
 * O aviso de que parte da seleção ficou de fora — a arquivada que não dá para
 * arquivar de novo, a publicada que não dá para apagar.
 *
 * Existe para o diálogo não mentir pelo silêncio: quem marcou cinco linhas e vê
 * "Apagar 3 matérias?" precisa saber o que houve com as outras duas ANTES de
 * confirmar, e não depois, num aviso de lote parcial.
 */
export function skippedNotice(
	skipped: number,
	action: BulkAction,
): string | null {
	if (skipped <= 0) {
		return null;
	}
	const verb = VERBS[action];
	return skipped === 1
		? `1 matéria da seleção não pode ser ${verb.one} e será ignorada.`
		: `${skipped} matérias da seleção não podem ser ${verb.many} e serão ignoradas.`;
}
