import {
	EDITORIAL_STATUSES,
	type EditorialStatus,
} from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

import {
	allows,
	bulkResultMessage,
	canArchive,
	canDelete,
	countLabel,
	DELETE_CONFIRMATION,
	eligibleIds,
	headerCheckboxState,
	isDeleteConfirmed,
	pruneSelection,
	requiresTypedConfirmation,
	skippedNotice,
	toggleAll,
	toggleSelection,
} from "@/lib/article-selection";

/**
 * O seletor da lista. Testado de verdade — e não com `it.todo` — porque o modo
 * de falhar dele é MUDO: uma seleção que inclui o que o servidor vai recusar não
 * parece errada na tela, ela só produz um lote que falha pela metade depois do
 * clique de confirmação. E esse clique já é irreversível o bastante para não ser
 * o lugar onde se descobre o problema.
 */

const article = (
	id: string,
	status: EditorialStatus,
	firstPublishedAt: Date | string | null = null,
) => ({ id, status, firstPublishedAt });

const PAGE = [
	article("a", "PUBLICADA", "2026-01-01T00:00:00Z"),
	article("b", "RASCUNHO"),
	article("c", "ATUALIZADA", "2026-01-01T00:00:00Z"),
	article("d", "ARQUIVADA", "2026-01-01T00:00:00Z"),
];

describe("canArchive", () => {
	it("vale para tudo que ainda não está no arquivo", () => {
		for (const status of EDITORIAL_STATUSES.filter((s) => s !== "ARQUIVADA")) {
			expect(canArchive(status)).toBe(true);
		}
	});

	it("já arquivada não se arquiva de novo", () => {
		expect(canArchive("ARQUIVADA")).toBe(false);
	});
});

describe("canDelete", () => {
	it("matéria NO AR não pode ser apagada", () => {
		// A que protege o endereço público: quem quiser eliminá-la arquiva antes.
		expect(canDelete("PUBLICADA")).toBe(false);
		expect(canDelete("ATUALIZADA")).toBe(false);
	});

	it("o que nunca chegou ao público, e o arquivo, podem", () => {
		for (const status of [
			"RASCUNHO",
			"EM_REVISAO",
			"APROVADA",
			"AGENDADA",
			"ARQUIVADA",
		] as const) {
			expect(canDelete(status)).toBe(true);
		}
	});
});

/**
 * A invariante que autoriza a caixinha da lista a nunca ficar desabilitada. Se
 * um dia entrar um status que não aceita nem uma coisa nem outra, a linha dele
 * passaria a ser marcável para nada — e é este teste que avisa.
 */
describe("cobertura das duas ações", () => {
	it("todo status permite arquivar OU apagar", () => {
		for (const status of EDITORIAL_STATUSES) {
			expect(canArchive(status) || canDelete(status)).toBe(true);
		}
	});

	it("`allows` despacha para a regra certa", () => {
		expect(allows("PUBLICADA", "archive")).toBe(true);
		expect(allows("PUBLICADA", "delete")).toBe(false);
		expect(allows("ARQUIVADA", "archive")).toBe(false);
		expect(allows("ARQUIVADA", "delete")).toBe(true);
	});
});

describe("eligibleIds", () => {
	const all = new Set(["a", "b", "c", "d"]);

	it("arquivar pega tudo, menos o que já está arquivado", () => {
		expect(eligibleIds(PAGE, all, "archive")).toEqual(["a", "b", "c"]);
	});

	it("apagar pega tudo, menos o que está no ar", () => {
		expect(eligibleIds(PAGE, all, "delete")).toEqual(["b", "d"]);
	});

	it("ignora o que não está selecionado", () => {
		expect(eligibleIds(PAGE, new Set(["b"]), "archive")).toEqual(["b"]);
	});

	it("seleção vazia não alcança nada", () => {
		expect(eligibleIds(PAGE, new Set(), "delete")).toEqual([]);
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

	it("marcada quando a página INTEIRA está marcada", () => {
		expect(headerCheckboxState(PAGE, new Set(["a", "b", "c", "d"]))).toBe(
			"checked",
		);
	});

	it("com uma linha faltando, continua indeterminada", () => {
		expect(headerCheckboxState(PAGE, new Set(["a", "b", "c"]))).toBe(
			"indeterminate",
		);
	});

	it("página vazia fica vazia, e não marcada", () => {
		// O risco é dizer "tudo marcado" sobre zero itens — a barra apareceria
		// anunciando uma seleção que não existe.
		expect(headerCheckboxState([], new Set())).toBe("unchecked");
	});
});

describe("toggleAll", () => {
	it("marca a página inteira", () => {
		expect([...toggleAll(PAGE, new Set())].sort()).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("desmarca quando a página inteira já estava marcada", () => {
		expect([...toggleAll(PAGE, new Set(["a", "b", "c", "d"]))]).toEqual([]);
	});

	it("parcialmente marcada, completa a seleção em vez de limpá-la", () => {
		expect([...toggleAll(PAGE, new Set(["a"]))].sort()).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("desmarcar aqui não desfaz a seleção de OUTRA página", () => {
		// "z" veio da página anterior; o clique foi nesta página.
		expect([...toggleAll(PAGE, new Set(["a", "b", "c", "d", "z"]))]).toEqual([
			"z",
		]);
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

describe("isDeleteConfirmed", () => {
	it("aceita a palavra exata", () => {
		expect(isDeleteConfirmed(DELETE_CONFIRMATION)).toBe(true);
	});

	it("aceita minúscula e espaço sobrando", () => {
		// A trava existe para obrigar a pessoa a PARAR e declarar o que vai
		// fazer, não para ser um jogo de acertar a grafia — quem erra duas vezes
		// aprende a colar o texto sem ler.
		expect(isDeleteConfirmed("apagar")).toBe(true);
		expect(isDeleteConfirmed("  Apagar  ")).toBe(true);
	});

	it("recusa vazio, outra palavra e palavra pela metade", () => {
		expect(isDeleteConfirmed("")).toBe(false);
		expect(isDeleteConfirmed("   ")).toBe(false);
		expect(isDeleteConfirmed("apag")).toBe(false);
		expect(isDeleteConfirmed("arquivar")).toBe(false);
		expect(isDeleteConfirmed("apagar tudo")).toBe(false);
	});
});

describe("requiresTypedConfirmation", () => {
	it("um rascunho que nunca foi ao ar NÃO pede a palavra", () => {
		// Exigir sempre é o caminho para ninguém mais ler o diálogo.
		expect(requiresTypedConfirmation([article("b", "RASCUNHO")])).toBe(false);
	});

	it("pede a palavra quando a matéria já esteve publicada", () => {
		expect(
			requiresTypedConfirmation([
				article("d", "ARQUIVADA", "2026-01-01T00:00:00Z"),
			]),
		).toBe(true);
	});

	it("pede a palavra em qualquer lote, mesmo só de rascunhos", () => {
		// O erro de mira do lote não se desfaz.
		expect(
			requiresTypedConfirmation([
				article("b", "RASCUNHO"),
				article("e", "RASCUNHO"),
			]),
		).toBe(true);
	});

	it("uma publicada no meio do lote basta", () => {
		expect(
			requiresTypedConfirmation([
				article("b", "RASCUNHO"),
				article("d", "ARQUIVADA", new Date("2026-01-01")),
			]),
		).toBe(true);
	});

	it("nada selecionado não pede nada", () => {
		expect(requiresTypedConfirmation([])).toBe(false);
	});
});

describe("skippedNotice", () => {
	it("cala quando nada ficou de fora", () => {
		expect(skippedNotice(0, "delete")).toBeNull();
		expect(skippedNotice(-1, "archive")).toBeNull();
	});

	it("conta no singular e no plural, com o verbo da ação", () => {
		expect(skippedNotice(1, "delete")).toContain("1 matéria");
		expect(skippedNotice(1, "delete")).toContain("apagada");
		expect(skippedNotice(2, "archive")).toContain("2 matérias");
		expect(skippedNotice(2, "archive")).toContain("arquivadas");
	});
});

describe("bulkResultMessage", () => {
	it("tudo certo, no singular", () => {
		expect(bulkResultMessage({ done: ["a"], failed: [] }, "archive")).toEqual({
			tone: "success",
			message: "1 matéria arquivada.",
		});
	});

	it("tudo certo, no plural", () => {
		expect(
			bulkResultMessage({ done: ["a", "b"], failed: [] }, "archive"),
		).toEqual({
			tone: "success",
			message: "2 matérias arquivadas.",
		});
	});

	it("usa o verbo de APAGAR quando é isso que aconteceu", () => {
		// Uma mensagem que diz "arquivada" depois de apagar é pior que nenhuma:
		// manda a redação procurar no arquivo o que não está em lugar nenhum.
		expect(bulkResultMessage({ done: ["a"], failed: [] }, "delete")).toEqual({
			tone: "success",
			message: "1 matéria apagada.",
		});
		expect(
			bulkResultMessage({ done: ["a", "b"], failed: [] }, "delete").message,
		).toBe("2 matérias apagadas.");
	});

	it("lote parcial avisa dos dois lados", () => {
		const result = bulkResultMessage(
			{
				done: ["a", "b"],
				failed: [{ id: "c", reason: "transição inválida" }],
			},
			"archive",
		);
		expect(result.tone).toBe("warning");
		// O que passou e o que ficou, na mesma frase: um aviso que só conta o
		// sucesso faz a redação achar que arquivou tudo.
		expect(result.message).toContain("2 matérias arquivadas");
		expect(result.message).toContain("1 não pôde");
	});

	it("lote parcial concorda o plural nos DOIS lados", () => {
		const result = bulkResultMessage(
			{
				done: ["a"],
				failed: [
					{ id: "b", reason: "x" },
					{ id: "c", reason: "y" },
				],
			},
			"delete",
		);
		expect(result.message).toContain("1 matéria apagada");
		expect(result.message).toContain("2 não puderam ser apagadas");
	});

	it("uma falha sozinha mostra o MOTIVO, não uma contagem", () => {
		const result = bulkResultMessage(
			{
				done: [],
				failed: [{ id: "c", reason: "matéria no ar não pode ser apagada" }],
			},
			"delete",
		);
		expect(result.tone).toBe("error");
		expect(result.message).toContain("matéria no ar não pode ser apagada");
		expect(result.message).toContain("apagar");
	});

	it("lote inteiro falhando é erro, não aviso", () => {
		const result = bulkResultMessage(
			{
				done: [],
				failed: [
					{ id: "a", reason: "x" },
					{ id: "b", reason: "y" },
				],
			},
			"archive",
		);
		expect(result.tone).toBe("error");
		expect(result.message).toContain("Nenhuma das 2");
	});
});
