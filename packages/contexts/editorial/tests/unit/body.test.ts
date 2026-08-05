import { Body, InvalidBlock } from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

/**
 * A normalização do corpo (ADR 0010) — a parte do domínio que traduz o que
 * chega, em qualquer um dos dois formatos, para os blocos canônicos.
 *
 * O que está sob teste aqui é a assimetria deliberada entre as duas portas:
 * `create` (escrita) VALIDA e devolve erro; `fromRaw` (leitura) DESCARTA o
 * irrecuperável e nunca falha, porque é o portal público que serve esse
 * conteúdo e ele não pode quebrar por causa de uma matéria antiga.
 */

describe("Body — formatação inline (ADR 0010)", () => {
	it("preserva negrito, itálico e link dentro do parágrafo", () => {
		const body = Body.create([
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "A obra custa " },
					{ type: "strong", text: "R$ 4 milhões" },
					{ type: "text", text: " e começa " },
					{ type: "em", text: "em março" },
					{ type: "text", text: ". Veja o " },
					{ type: "link", text: "edital", href: "https://exemplo.com/edital" },
				],
			},
		]).unwrap();

		const [block] = body.blocks;
		expect(block?.type).toBe("paragraph");
		expect(block).toMatchObject({
			content: [
				{ type: "text" },
				{ type: "strong", text: "R$ 4 milhões" },
				{ type: "text" },
				{ type: "em", text: "em março" },
				{ type: "text" },
				{ type: "link", href: "https://exemplo.com/edital" },
			],
		});
	});

	it("aceita inline em título, citação e itens de lista", () => {
		const body = Body.create([
			{
				type: "heading",
				level: 3,
				content: [{ type: "strong", text: "Prazos" }],
			},
			{
				type: "quote",
				content: [{ type: "em", text: "Vamos entregar" }],
				cite: "Prefeito",
			},
			{
				type: "list",
				ordered: true,
				items: [[{ type: "text", text: "Primeiro" }], "Segundo"],
			},
		]).unwrap();

		expect(body.blocks).toHaveLength(3);
		expect(body.plainText()).toBe("Prazos Vamos entregar Primeiro Segundo");
	});

	it("degrada link sem destino para texto, em vez de perder o trecho", () => {
		const body = Body.create([
			{
				type: "paragraph",
				// `href` ausente: o nó não é um link válido, mas o texto importa.
				content: [{ type: "link", text: "sem destino" } as never],
			},
		]).unwrap();

		expect(body.blocks[0]).toMatchObject({
			content: [{ type: "text", text: "sem destino" }],
		});
	});

	it("descarta nós inline sem texto e de tipo desconhecido", () => {
		const body = Body.create([
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "fica" },
					{ type: "text", text: "" },
					{ type: "sublinhado", text: "vira texto" } as never,
					null as never,
					42 as never,
				],
			},
		]).unwrap();

		expect(body.blocks[0]).toMatchObject({
			content: [
				{ type: "text", text: "fica" },
				{ type: "text", text: "vira texto" },
			],
		});
	});
});

describe("Body — retrocompatibilidade com o formato anterior", () => {
	it("converte `text: string` em um nó de texto", () => {
		const body = Body.create([
			{ type: "paragraph", text: "Parágrafo antigo." },
			{ type: "heading", level: 2, text: "Título antigo" },
			{ type: "quote", text: "Citação antiga", cite: "Alguém" },
			{ type: "list", ordered: false, items: ["um", "dois"] },
		]).unwrap();

		expect(body.blocks[0]).toMatchObject({
			type: "paragraph",
			content: [{ type: "text", text: "Parágrafo antigo." }],
		});
		expect(body.blocks[3]).toMatchObject({
			type: "list",
			items: [[{ type: "text", text: "um" }], [{ type: "text", text: "dois" }]],
		});
	});

	it("aceita os dois formatos misturados no mesmo corpo", () => {
		const body = Body.create([
			{ type: "paragraph", text: "antigo" },
			{ type: "paragraph", content: [{ type: "strong", text: "novo" }] },
		]).unwrap();

		expect(body.blocks).toHaveLength(2);
		expect(body.plainText()).toBe("antigo novo");
	});
});

describe("Body.create — a porta de escrita valida", () => {
	it("rejeita bloco cujo conteúdo inline ficou vazio", () => {
		const bad = [
			[{ type: "paragraph", content: [] }],
			[{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
			[{ type: "heading", level: 2, content: [] }],
			[{ type: "quote", content: [] }],
			[{ type: "list", ordered: true, items: [[]] }],
		] as const;

		for (const blocks of bad) {
			expect(Body.create(blocks).unwrapErr()).toBeInstanceOf(InvalidBlock);
		}
	});

	it("rejeita bloco de tipo desconhecido", () => {
		expect(
			Body.create([{ type: "carrossel" } as never]).unwrapErr(),
		).toBeInstanceOf(InvalidBlock);
	});

	it("rejeita imagem e embed malformados", () => {
		expect(
			Body.create([{ type: "image", mediaId: 42 } as never]).unwrapErr(),
		).toBeInstanceOf(InvalidBlock);
		expect(
			Body.create([{ type: "embed", url: null } as never]).unwrapErr(),
		).toBeInstanceOf(InvalidBlock);
	});
});

describe("Body.fromRaw — a porta de leitura nunca falha", () => {
	it("cura conteúdo gravado no formato antigo", () => {
		const body = Body.fromRaw([
			{ type: "paragraph", text: "Matéria de 2026." },
			{ type: "list", ordered: false, items: ["a", "b"] },
		]);

		expect(body.blocks).toHaveLength(2);
		expect(body.blocks[0]).toMatchObject({
			content: [{ type: "text", text: "Matéria de 2026." }],
		});
	});

	it("descarta o bloco corrompido e mantém o resto da matéria", () => {
		const body = Body.fromRaw([
			{ type: "paragraph", text: "vale" },
			{ type: "paragraph", text: "   " },
			{ type: "carrossel", slides: 3 },
			{ type: "embed", url: "não-é-url" },
			null,
			"lixo",
			{ type: "paragraph", text: "também vale" },
		]);

		expect(body.plainText()).toBe("vale também vale");
	});

	it("devolve corpo vazio para qualquer coisa que não seja lista", () => {
		for (const raw of [null, undefined, {}, "texto", 7]) {
			expect(Body.fromRaw(raw).isEmpty()).toBe(true);
		}
	});

	it("mantém legenda da imagem e cite da citação quando presentes", () => {
		const body = Body.fromRaw([
			{ type: "image", mediaId: "m-1", caption: "Obras na BR-343" },
			{ type: "quote", text: "É prioridade", cite: "Secretário" },
		]);

		expect(body.blocks[0]).toMatchObject({ caption: "Obras na BR-343" });
		expect(body.blocks[1]).toMatchObject({ cite: "Secretário" });
	});
});
