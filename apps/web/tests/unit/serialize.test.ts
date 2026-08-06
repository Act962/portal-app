import { describe, expect, it } from "vitest";

import {
	blocksToDoc,
	docToBlocks,
} from "@/components/editorial/rich-text/serialize";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * Este é o teste mais barato e mais valioso que falta no produto: o serializador
 * é o que traduz o que o jornalista digita para o que o domínio guarda. Uma
 * regressão aqui não estoura em lugar nenhum — ela faz o autosave falhar em
 * silêncio, ou apaga formatação sem ninguém perceber até a matéria estar no ar.
 *
 * O caso de fumaça abaixo é real e roda: ele existe para provar que o arranjo
 * está de pé (o alias `@/` resolve, o módulo importa fora do Next, o round-trip
 * fecha). Os `it.todo` são a lista de casos-limite levantada enquanto o código
 * estava fresco — implementar é preencher, não redescobrir.
 */
describe("serialize (TipTap ↔ blocos do domínio)", () => {
	it("fecha a ida e volta de um parágrafo simples", () => {
		const blocks = [
			{ type: "paragraph", content: [{ type: "text", text: "Olá" }] },
		] as const;

		expect(docToBlocks(blocksToDoc([...blocks]))).toEqual(blocks);
	});

	// --- O que sustenta o autosave -----------------------------------------
	it.todo(
		"descarta o parágrafo vazio que o TipTap sempre mantém no fim do documento",
	);
	it.todo("descarta heading e citação em branco, pelo mesmo motivo");
	it.todo("devolve lista vazia para um documento nulo ou sem conteúdo");

	// --- Formatação inline (ADR 0010) --------------------------------------
	it.todo("preserva negrito, itálico e link dentro do parágrafo");
	it.todo("link sem href vira texto simples, em vez de sumir");
	it.todo("quebra de linha vira espaço no nó anterior");

	// --- Compatibilidade ----------------------------------------------------
	it.todo("aceita corpo no formato anterior ao ADR 0010 (content como string)");

	// --- Demais blocos ------------------------------------------------------
	it.todo("heading fora dos níveis 2 e 3 cai para 2");
	it.todo("lista ordenada e não ordenada sobrevivem à ida e volta");
	it.todo("imagem preserva mediaId e legenda");
	it.todo("citação preserva a fonte (cite)");
	it.todo("embed preserva a url");

	// --- A propriedade que resume todas as anteriores ------------------------
	it.todo(
		"round-trip: docToBlocks(blocksToDoc(b)) === b para todo corpo válido",
	);
});
