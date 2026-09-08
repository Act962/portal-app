import type { Block } from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

import {
	blocksToDoc,
	docToBlocks,
} from "@/components/editorial/rich-text/serialize";

/**
 * O serializador: o que traduz o que o jornalista digita para o que o domínio
 * guarda.
 *
 * Nasceu como esqueleto de `it.todo` (a regra do `CLAUDE.md`), e a dívida foi
 * paga em 08/09, junto com a mudança que trouxe sublinhado, riscado e
 * alinhamento. A razão de pagar AGORA e não depois: uma regressão aqui não
 * estoura em lugar nenhum — ela apaga formatação em silêncio, e quem descobre é
 * a redação, com a matéria já no ar.
 */

/** O documento que o TipTap entrega, montado à mão como ele realmente sai. */
const doc = (...content: unknown[]) => ({ type: "doc", content }) as never;

const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

const text = (value: string, marks?: unknown[]) => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});

describe("serialize (TipTap ↔ blocos do domínio)", () => {
	it("fecha a ida e volta de um parágrafo simples", () => {
		// Sem `as const`: `Block` tem `content` mutável, e o literal congelado não
		// é atribuível a ele.
		const blocks: Block[] = [
			{ type: "paragraph", content: [{ type: "text", text: "Olá" }] },
		];

		expect(docToBlocks(blocksToDoc(blocks))).toEqual(blocks);
	});

	// --- O que sustenta o autosave -----------------------------------------

	it("descarta o parágrafo vazio que o TipTap sempre mantém no fim do documento", () => {
		// Este é o caso que, sem o descarte, faria TODO autosave falhar com
		// InvalidBlock: `Body.create` recusa parágrafo sem texto, e o TipTap
		// mantém um no fim do documento o tempo todo.
		const blocks = docToBlocks(
			doc(paragraph(text("Primeiro")), { type: "paragraph" }),
		);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ type: "paragraph" });
	});

	it("descarta heading e citação em branco, pelo mesmo motivo", () => {
		const blocks = docToBlocks(
			doc(
				{ type: "heading", attrs: { level: 2 }, content: [] },
				{ type: "blockquote", content: [{ type: "paragraph" }] },
				paragraph(text("Sobra este")),
			),
		);

		expect(blocks).toEqual([
			{ type: "paragraph", content: [{ type: "text", text: "Sobra este" }] },
		]);
	});

	it("descarta parágrafo que só tem espaço em branco", () => {
		expect(docToBlocks(doc(paragraph(text("   "))))).toEqual([]);
	});

	it("devolve lista vazia para um documento nulo ou sem conteúdo", () => {
		expect(docToBlocks(null)).toEqual([]);
		expect(docToBlocks(undefined)).toEqual([]);
		expect(docToBlocks(doc())).toEqual([]);
	});

	// --- Formatação inline --------------------------------------------------

	it("preserva negrito, itálico e link dentro do parágrafo", () => {
		const blocks = docToBlocks(
			doc(
				paragraph(
					text("A obra custa "),
					text("R$ 4 milhões", [{ type: "bold" }]),
					text(" e começa "),
					text("em março", [{ type: "italic" }]),
					text(", veja o "),
					text("edital", [
						{ type: "link", attrs: { href: "https://exemplo.com" } },
					]),
				),
			),
		);

		expect(blocks[0]).toMatchObject({
			content: [
				{ type: "text", text: "A obra custa " },
				{ type: "text", text: "R$ 4 milhões", marks: ["strong"] },
				{ type: "text", text: " e começa " },
				{ type: "text", text: "em março", marks: ["em"] },
				{ type: "text", text: ", veja o " },
				{ type: "link", text: "edital", href: "https://exemplo.com" },
			],
		});
	});

	it("preserva sublinhado e riscado", () => {
		const blocks = docToBlocks(
			doc(
				paragraph(
					text("importante", [{ type: "underline" }]),
					text("cancelado", [{ type: "strike" }]),
				),
			),
		);

		expect(blocks[0]).toMatchObject({
			content: [
				{ text: "importante", marks: ["underline"] },
				{ text: "cancelado", marks: ["strike"] },
			],
		});
	});

	it("guarda marcas COMBINADAS — o defeito que a mudança de 08/09 corrigiu", () => {
		// Antes disto o serializador achatava por precedência e devolvia só
		// `strong`: o sublinhado sumia entre o que se digitou e o que foi salvo.
		const blocks = docToBlocks(
			doc(
				paragraph(text("Atenção", [{ type: "bold" }, { type: "underline" }])),
			),
		);

		expect(blocks[0]).toMatchObject({
			content: [{ text: "Atenção", marks: ["strong", "underline"] }],
		});
	});

	it("normaliza a ordem das marcas — a mesma seleção gera sempre o mesmo JSON", () => {
		const [a] = docToBlocks(
			doc(paragraph(text("x", [{ type: "underline" }, { type: "bold" }]))),
		);
		const [b] = docToBlocks(
			doc(paragraph(text("x", [{ type: "bold" }, { type: "underline" }]))),
		);

		expect(a).toEqual(b);
	});

	it("link também carrega marcas — negrito dentro de link é normal", () => {
		const blocks = docToBlocks(
			doc(
				paragraph(
					text("edital", [
						{ type: "bold" },
						{ type: "link", attrs: { href: "https://exemplo.com" } },
					]),
				),
			),
		);

		expect(blocks[0]).toMatchObject({
			content: [
				{
					type: "link",
					href: "https://exemplo.com",
					marks: ["strong"],
				},
			],
		});
	});

	it("ignora marca que o domínio não conhece, sem perder o texto", () => {
		// É o que chega colado de fora: uma marca que a barra não oferece.
		const blocks = docToBlocks(
			doc(paragraph(text("colado", [{ type: "highlight" }]))),
		);

		expect(blocks[0]).toMatchObject({
			content: [{ type: "text", text: "colado" }],
		});
		expect(blocks[0]).not.toHaveProperty("content.0.marks");
	});

	it("link sem href vira texto simples, em vez de sumir", () => {
		const blocks = docToBlocks(
			doc(paragraph(text("sem destino", [{ type: "link", attrs: {} }]))),
		);

		expect(blocks[0]).toMatchObject({
			content: [{ type: "text", text: "sem destino" }],
		});
	});

	it("quebra de linha vira espaço no nó anterior", () => {
		// O domínio não tem o conceito de quebra dentro do parágrafo; virar espaço
		// é a perda declarada, e ela precisa ficar registrada como decisão e não
		// como acidente.
		const blocks = docToBlocks(
			doc(
				paragraph(text("linha um"), { type: "hardBreak" }, text("linha dois")),
			),
		);

		expect(blocks[0]).toMatchObject({
			content: [{ text: "linha um " }, { text: "linha dois" }],
		});
	});

	// --- Alinhamento --------------------------------------------------------

	it("preserva o alinhamento de parágrafo e de título", () => {
		const blocks = docToBlocks(
			doc(
				{
					type: "paragraph",
					attrs: { textAlign: "justify" },
					content: [text("Justificado")],
				},
				{
					type: "heading",
					attrs: { level: 2, textAlign: "center" },
					content: [text("Centralizado")],
				},
			),
		);

		expect(blocks[0]).toMatchObject({ align: "justify" });
		expect(blocks[1]).toMatchObject({ align: "center", level: 2 });
	});

	it("não grava o alinhamento padrão — 'left' e ausente são a mesma coisa", () => {
		const blocks = docToBlocks(
			doc(
				{
					type: "paragraph",
					attrs: { textAlign: "left" },
					content: [text("Normal")],
				},
				paragraph(text("Também normal")),
			),
		);

		expect(blocks[0]).not.toHaveProperty("align");
		expect(blocks[1]).not.toHaveProperty("align");
	});

	// --- Demais blocos ------------------------------------------------------

	it("heading fora dos níveis 2 e 3 cai para 2", () => {
		const blocks = docToBlocks(
			doc({ type: "heading", attrs: { level: 5 }, content: [text("Título")] }),
		);

		expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
	});

	it("lista ordenada e não ordenada sobrevivem à ida e volta", () => {
		const blocks: Block[] = [
			{
				type: "list",
				ordered: false,
				items: [
					[{ type: "text", text: "Primeiro" }],
					[{ type: "text", text: "Segundo", marks: ["strong"] }],
				],
			},
			{
				type: "list",
				ordered: true,
				items: [[{ type: "text", text: "Um" }]],
			},
		];

		expect(docToBlocks(blocksToDoc(blocks))).toEqual(blocks);
	});

	it("imagem preserva mediaId e legenda", () => {
		const blocks: Block[] = [
			{ type: "image", mediaId: "abc123", caption: "Obra na BR-343" },
		];

		expect(docToBlocks(blocksToDoc(blocks))).toEqual(blocks);
	});

	it("imagem sem mediaId é descartada", () => {
		expect(
			docToBlocks(doc({ type: "mediaImage", attrs: { mediaId: "" } })),
		).toEqual([]);
	});

	it("citação sobrevive à ida e volta", () => {
		// O `cite` NÃO volta: o documento do TipTap não tem onde guardá-lo (a
		// citação vira `blockquote > paragraph`). É perda conhecida — quem edita
		// a fonte no painel o faz fora do editor de corpo.
		const blocks = docToBlocks(
			blocksToDoc([
				{
					type: "quote",
					content: [{ type: "text", text: "Vamos entregar" }],
					cite: "Prefeito",
				},
			]),
		);

		expect(blocks[0]).toMatchObject({
			type: "quote",
			content: [{ type: "text", text: "Vamos entregar" }],
		});
	});

	it("embed preserva a url e recusa endereço malformado", () => {
		expect(
			docToBlocks(
				doc(
					{ type: "embed", attrs: { url: "https://youtu.be/abc" } },
					{ type: "embed", attrs: { url: "isto não é url" } },
				),
			),
		).toEqual([{ type: "embed", url: "https://youtu.be/abc" }]);
	});

	// --- A propriedade que resume todas as anteriores ------------------------

	it("round-trip: docToBlocks(blocksToDoc(b)) === b para todo corpo válido", () => {
		const blocks: Block[] = [
			{
				type: "heading",
				level: 2,
				content: [{ type: "text", text: "Motivos" }],
				align: "center",
			},
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "A obra custa " },
					{ type: "text", text: "R$ 4 mi", marks: ["strong", "underline"] },
					{ type: "text", text: " e " },
					{
						type: "link",
						text: "o edital",
						href: "https://exemplo.com",
						marks: ["em"],
					},
				],
				align: "justify",
			},
			{
				type: "list",
				ordered: true,
				items: [[{ type: "text", text: "Etapa 1", marks: ["strike"] }]],
			},
			{ type: "image", mediaId: "m1", caption: "Legenda" },
			{ type: "embed", url: "https://exemplo.com/video" },
		];

		expect(docToBlocks(blocksToDoc(blocks))).toEqual(blocks);
	});
});
