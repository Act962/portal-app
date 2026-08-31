import type { EditorialStatus } from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

import {
	archivableIds,
	archiveResultMessage,
	countLabel,
	headerCheckboxState,
	isArchivable,
	pruneSelection,
	toggleAll,
	toggleSelection,
} from "@/lib/article-selection";

/**
 * O seletor de arquivamento em lote. Testado de verdade — e não com `it.todo` —
 * porque o modo de falhar dele é MUDO: uma seleção que inclui o que o domínio
 * não arquiva não parece errada na tela, ela só produz um lote que falha pela
 * metade depois do clique de confirmação. E o clique já é irreversível o
 * bastante para não ser o lugar onde se descobre o problema.
 */

const article = (id: string, status: EditorialStatus) => ({ id, status });

const PAGE = [
	article("a", "PUBLICADA"),
	article("b", "RASCUNHO"),
	article("c", "ATUALIZADA"),
	article("d", "ARQUIVADA"),
];

describe("isArchivable", () => {
	it("só matéria no ar entra no arquivo", () => {
		expect(isArchivable("PUBLICADA")).toBe(true);
		expect(isArchivable("ATUALIZADA")).toBe(true);
	});

	it("rascunho, revisão, aprovada e agendada ficam de fora", () => {
		for (const status of [
			"RASCUNHO",
			"EM_REVISAO",
			"APROVADA",
			"AGENDADA",
		] as const) {
			expect(isArchivable(status)).toBe(false);
		}
	});

	it("já arquivada não se arquiva de novo", () => {
		expect(isArchivable("ARQUIVADA")).toBe(false);
	});
});

describe("archivableIds", () => {
	it("devolve apenas o que o domínio aceitaria arquivar", () => {
		expect(archivableIds(PAGE)).toEqual(["a", "c"]);
	});

	it("página sem nada publicado devolve vazio", () => {
		expect(archivableIds([article("b", "RASCUNHO")])).toEqual([]);
	});
});

describe("toggleSelection", () => {
	it("marca o que não estava marcado", () => {
		expect([...toggleSelection(new Set(), "a")]).toEqual(["a"]);
	});

	it("desmarca o que já estava", () => {
		expect([...toggleSelection(new Set(["a", "b"]), "a")]).toEqual(["b"]);
	});

	it("não muta o conjunto recebido", () => {
		const before = new Set(["a"]);
		toggleSelection(before, "b");
		expect([...before]).toEqual(["a"]);
	});
});

describe("headerCheckboxState", () => {
	it("vazia quando nada está marcado", () => {
		expect(headerCheckboxState(PAGE, new Set())).toBe("unchecked");
	});

	it("indeterminada com parte da página marcada", () => {
		expect(headerCheckboxState(PAGE, new Set(["a"]))).toBe("indeterminate");
	});

	it("marcada quando TODO o marcável da página está marcado", () => {
		// "d" está arquivada e "b" é rascunho: nenhuma das duas conta.
		expect(headerCheckboxState(PAGE, new Set(["a", "c"]))).toBe("checked");
	});

	it("página sem nada marcável fica vazia, e não marcada", () => {
		// O risco é dizer "tudo marcado" sobre zero itens — a barra apareceria
		// dizendo que há uma seleção que não existe.
		expect(headerCheckboxState([article("b", "RASCUNHO")], new Set())).toBe(
			"unchecked",
		);
	});
});

describe("toggleAll", () => {
	it("marca todo o marcável da página, e só ele", () => {
		expect([...toggleAll(PAGE, new Set())].sort()).toEqual(["a", "c"]);
	});

	it("desmarca quando a página inteira já estava marcada", () => {
		expect([...toggleAll(PAGE, new Set(["a", "c"]))]).toEqual([]);
	});

	it("parcialmente marcada, completa a seleção em vez de limpá-la", () => {
		expect([...toggleAll(PAGE, new Set(["a"]))].sort()).toEqual(["a", "c"]);
	});

	it("desmarcar aqui não desfaz a seleção de OUTRA página", () => {
		// "z" veio da página anterior; o clique foi nesta página.
		expect([...toggleAll(PAGE, new Set(["a", "c", "z"]))]).toEqual(["z"]);
	});
});

describe("pruneSelection", () => {
	it("descarta o que saiu da lista", () => {
		expect([...pruneSelection(new Set(["a", "z"]), ["a", "b"])]).toEqual(["a"]);
	});

	it("lista vazia zera a seleção", () => {
		expect([...pruneSelection(new Set(["a"]), [])]).toEqual([]);
	});
});

describe("countLabel", () => {
	it("concorda no singular e no plural", () => {
		expect(countLabel(1)).toBe("1 matéria");
		expect(countLabel(3)).toBe("3 matérias");
		expect(countLabel(0)).toBe("0 matérias");
	});
});

describe("archiveResultMessage", () => {
	it("tudo certo, no singular", () => {
		expect(archiveResultMessage({ archived: ["a"], failed: [] })).toEqual({
			tone: "success",
			message: "1 matéria arquivada.",
		});
	});

	it("tudo certo, no plural", () => {
		expect(archiveResultMessage({ archived: ["a", "b"], failed: [] })).toEqual({
			tone: "success",
			message: "2 matérias arquivadas.",
		});
	});

	it("lote parcial avisa dos dois lados", () => {
		const result = archiveResultMessage({
			archived: ["a", "b"],
			failed: [{ id: "c", reason: "transição inválida" }],
		});
		expect(result.tone).toBe("warning");
		// O que passou e o que ficou, na mesma frase: um aviso que só conta o
		// sucesso faz a redação achar que arquivou tudo.
		expect(result.message).toContain("2 matérias arquivadas");
		expect(result.message).toContain("1 não pôde");
	});

	it("uma falha sozinha mostra o MOTIVO, não uma contagem", () => {
		const result = archiveResultMessage({
			archived: [],
			failed: [{ id: "c", reason: "transição inválida de RASCUNHO" }],
		});
		expect(result.tone).toBe("error");
		expect(result.message).toContain("transição inválida de RASCUNHO");
	});

	it("lote inteiro falhando é erro, não aviso", () => {
		const result = archiveResultMessage({
			archived: [],
			failed: [
				{ id: "a", reason: "x" },
				{ id: "b", reason: "y" },
			],
		});
		expect(result.tone).toBe("error");
		expect(result.message).toContain("Nenhuma das 2");
	});
});
