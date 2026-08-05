import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidBlock } from "./errors";

/**
 * Nós inline — a formatação DENTRO de um texto (ADR 0010). União plana: um nó
 * carrega um trecho e a marca que o cobre. O editor achata marcas combinadas
 * (negrito dentro de link vira link), o que evita um modelo aninhado no domínio.
 */
export type InlineNode =
	| { type: "text"; text: string }
	| { type: "strong"; text: string }
	| { type: "em"; text: string }
	| { type: "link"; text: string; href: string };

/**
 * Blocos do corpo (D1/ADR 0003, estendido pelo ADR 0010). União discriminada por
 * `type`, validada no domínio: o corpo é dado estruturado, não HTML —
 * renderização controlada e segura (sem `dangerouslySetInnerHTML`), e novos
 * blocos entram sem migração.
 */
export type Block =
	| { type: "paragraph"; content: InlineNode[] }
	| { type: "heading"; level: 2 | 3; content: InlineNode[] }
	| { type: "image"; mediaId: string; caption?: string }
	| { type: "list"; ordered: boolean; items: InlineNode[][] }
	| { type: "quote"; content: InlineNode[]; cite?: string }
	| { type: "embed"; url: string };

/**
 * O que é ACEITO na entrada. Além do formato atual, tolera o formato anterior ao
 * ADR 0010 (`text: string` no lugar de `content`, `items: string[]` na lista),
 * porque há conteúdo gravado assim. A normalização converte na porta de entrada;
 * de dentro para fora só existe o formato novo.
 */
export type InlineInput = readonly InlineNode[] | string;

export type BlockInput =
	| { type: "paragraph"; content: InlineInput }
	| { type: "paragraph"; text: string }
	| { type: "heading"; level: 2 | 3; content: InlineInput }
	| { type: "heading"; level: 2 | 3; text: string }
	| { type: "quote"; content: InlineInput; cite?: string }
	| { type: "quote"; text: string; cite?: string }
	| { type: "image"; mediaId: string; caption?: string }
	| { type: "list"; ordered: boolean; items: readonly InlineInput[] }
	| { type: "embed"; url: string };

/**
 * Corpo da matéria — lista ordenada de blocos. Objeto de valor imutável.
 *
 * Duas portas, com semânticas deliberadamente diferentes:
 * - `create` (escrita) normaliza **e valida**: erro é erro.
 * - `fromRaw` (leitura) normaliza e descarta o irrecuperável, **nunca falha** —
 *   o portal público serve este conteúdo e não pode explodir por formato velho.
 *
 * Corpo vazio é permitido no rascunho; a publicação é que exige corpo
 * (invariante do agregado).
 */
export class Body extends ValueObject<{ blocks: readonly Block[] }> {
	private constructor(blocks: readonly Block[]) {
		super({ blocks });
	}

	static empty(): Body {
		return new Body([]);
	}

	static create(blocks: readonly BlockInput[]): Result<Body, InvalidBlock> {
		const normalized: Block[] = [];
		for (const input of blocks) {
			const block = normalizeBlock(input);
			if (!block) {
				return err(new InvalidBlock("bloco de tipo desconhecido"));
			}
			const problem = validate(block);
			if (problem) {
				return err(new InvalidBlock(problem));
			}
			normalized.push(block);
		}
		return ok(new Body(normalized));
	}

	/** Reidrata da persistência. Blocos irrecuperáveis são descartados em
	 * silêncio — uma matéria com um bloco corrompido ainda deve ser lida. */
	static fromRaw(raw: unknown): Body {
		if (!Array.isArray(raw)) {
			return Body.empty();
		}
		const blocks: Block[] = [];
		for (const input of raw) {
			const block = normalizeBlock(input as BlockInput);
			if (block && !validate(block)) {
				blocks.push(block);
			}
		}
		return new Body(blocks);
	}

	get blocks(): readonly Block[] {
		return this.props.blocks;
	}

	isEmpty(): boolean {
		return this.props.blocks.length === 0;
	}

	/** O texto corrido do corpo — para contagem de palavras, resumo e busca. */
	plainText(): string {
		return this.props.blocks.map(blockText).filter(Boolean).join(" ");
	}
}

// --- Normalização ----------------------------------------------------------

/** Converte a entrada (nova ou legada) num bloco canônico. `null` = tipo
 * desconhecido, que a escrita rejeita e a leitura descarta. */
function normalizeBlock(input: BlockInput | undefined | null): Block | null {
	if (!input || typeof input !== "object" || !("type" in input)) {
		return null;
	}

	switch (input.type) {
		case "paragraph":
			return { type: "paragraph", content: normalizeInline(contentOf(input)) };
		case "heading":
			return {
				type: "heading",
				level: (input as { level: 2 | 3 }).level,
				content: normalizeInline(contentOf(input)),
			};
		case "quote": {
			const cite = (input as { cite?: string }).cite;
			return {
				type: "quote",
				content: normalizeInline(contentOf(input)),
				...(cite ? { cite } : {}),
			};
		}
		case "image": {
			const { mediaId, caption } = input as {
				mediaId: string;
				caption?: string;
			};
			return {
				type: "image",
				mediaId: typeof mediaId === "string" ? mediaId : "",
				...(caption ? { caption } : {}),
			};
		}
		case "list": {
			const { ordered, items } = input as {
				ordered: boolean;
				items: readonly InlineInput[];
			};
			return {
				type: "list",
				ordered: Boolean(ordered),
				items: (Array.isArray(items) ? items : []).map((item) =>
					normalizeInline(item),
				),
			};
		}
		case "embed": {
			const { url } = input as { url: string };
			return { type: "embed", url: typeof url === "string" ? url : "" };
		}
		default:
			return null;
	}
}

/** Extrai o conteúdo inline, aceitando `content` (novo) ou `text` (legado). */
function contentOf(input: object): string | readonly unknown[] {
	if ("content" in input && Array.isArray(input.content)) {
		return input.content;
	}
	if ("text" in input && typeof input.text === "string") {
		return input.text;
	}
	return [];
}

/** Uma string vira um único nó de texto; um array é filtrado nó a nó. */
function normalizeInline(value: string | readonly unknown[]): InlineNode[] {
	if (typeof value === "string") {
		return value ? [{ type: "text", text: value }] : [];
	}
	if (!Array.isArray(value)) {
		return [];
	}

	const nodes: InlineNode[] = [];
	for (const raw of value) {
		if (typeof raw === "string") {
			if (raw) {
				nodes.push({ type: "text", text: raw });
			}
			continue;
		}
		if (!raw || typeof raw !== "object") {
			continue;
		}
		const node = raw as { type?: string; text?: unknown; href?: unknown };
		if (typeof node.text !== "string" || !node.text) {
			continue;
		}
		if (node.type === "link") {
			// Link sem destino não é link — degrada para texto em vez de sumir.
			nodes.push(
				typeof node.href === "string" && node.href
					? { type: "link", text: node.text, href: node.href }
					: { type: "text", text: node.text },
			);
			continue;
		}
		if (node.type === "strong" || node.type === "em") {
			nodes.push({ type: node.type, text: node.text });
			continue;
		}
		nodes.push({ type: "text", text: node.text });
	}
	return nodes;
}

// --- Validação -------------------------------------------------------------

function inlineText(nodes: readonly InlineNode[]): string {
	return nodes.map((node) => node.text).join("");
}

function blockText(block: Block): string {
	switch (block.type) {
		case "paragraph":
		case "heading":
		case "quote":
			return inlineText(block.content);
		case "list":
			return block.items.map(inlineText).join(" ");
		default:
			return "";
	}
}

/** Devolve a razão da invalidez, ou `null` se o bloco é válido. */
function validate(block: Block): string | null {
	switch (block.type) {
		case "paragraph":
			return inlineText(block.content).trim() ? null : "parágrafo sem texto";
		case "heading":
			if (block.level !== 2 && block.level !== 3) {
				return "título só aceita nível 2 ou 3";
			}
			return inlineText(block.content).trim() ? null : "título sem texto";
		case "image":
			return block.mediaId.trim() ? null : "imagem sem mídia";
		case "list":
			if (block.items.length === 0) {
				return "lista sem itens";
			}
			return block.items.every((item) => inlineText(item).trim() !== "")
				? null
				: "lista com item vazio";
		case "quote":
			return inlineText(block.content).trim() ? null : "citação sem texto";
		case "embed":
			return /^https?:\/\/.+/.test(block.url.trim())
				? null
				: "embed com URL inválida";
	}
}
