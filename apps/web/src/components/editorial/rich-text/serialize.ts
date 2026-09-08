import type {
	Block,
	BlockAlign,
	BlockLineHeight,
	InlineMark,
	InlineNode,
} from "@portal-app/editorial";
import {
	BLOCK_ALIGNMENTS,
	BLOCK_LINE_HEIGHTS,
	INLINE_MARKS,
} from "@portal-app/editorial";

/**
 * A tradução entre o documento do TipTap (ProseMirror) e os blocos do domínio.
 *
 * É o contrato do ADR 0003: o editor vive na interface e EMITE blocos; trocar de
 * editor um dia não toca domínio nem portal. Módulo puro de propósito — sem JSX
 * e sem React — para ser testável e para não arrastar o editor consigo.
 */

type PmMark = { type: string; attrs?: Record<string, unknown> };
type PmNode = {
	type?: string;
	text?: string;
	marks?: PmMark[];
	attrs?: Record<string, unknown>;
	content?: PmNode[];
};

// --- Blocos do domínio → documento do editor -------------------------------

/**
 * O nome da marca no domínio ↔ o nome dela no TipTap.
 *
 * Os dois discordam de propósito: `strong`/`em` são os nomes do HTML e do
 * domínio, `bold`/`italic` são os das extensões do ProseMirror. Traduzir num
 * lugar só é o que impede a divergência silenciosa — um `toggleBold()` que
 * grava uma marca que o portal não conhece.
 */
const PM_MARK: Record<InlineMark, string> = {
	strong: "bold",
	em: "italic",
	underline: "underline",
	strike: "strike",
};

const DOMAIN_MARK = new Map<string, InlineMark>(
	INLINE_MARKS.map((mark) => [PM_MARK[mark], mark]),
);

function inlineToPm(nodes: readonly InlineNode[]): PmNode[] {
	return nodes
		.filter((node) => node.text)
		.map((node) => {
			const marks: PmMark[] = (node.marks ?? []).map((mark) => ({
				type: PM_MARK[mark],
			}));
			if (node.type === "link") {
				marks.push({ type: "link", attrs: { href: node.href } });
			}
			return marks.length > 0
				? { type: "text", text: node.text, marks }
				: { type: "text", text: node.text };
		});
}

/** `textAlign` do TipTap → `align` do domínio. `left` e ausente são a mesma
 * coisa, e o domínio representa as duas pela ausência. */
function alignToDomain(attrs: Record<string, unknown> | undefined): {
	align?: BlockAlign;
} {
	const value = attrs?.textAlign;
	return BLOCK_ALIGNMENTS.includes(value as BlockAlign)
		? { align: value as BlockAlign }
		: {};
}

/** O caminho de volta. `null` deixa a extensão aplicar o padrão dela. */
function alignToPm(align: BlockAlign | undefined) {
	return { textAlign: align ?? null };
}

/** `lineHeight` do editor → o do domínio. Valor fora da lista some: é o que o
 * domínio faria de qualquer forma, e fazê-lo aqui evita a viagem. */
function lineHeightToDomain(attrs: Record<string, unknown> | undefined): {
	lineHeight?: BlockLineHeight;
} {
	const value = attrs?.lineHeight;
	return BLOCK_LINE_HEIGHTS.includes(value as BlockLineHeight)
		? { lineHeight: value as BlockLineHeight }
		: {};
}

function lineHeightToPm(lineHeight: BlockLineHeight | undefined) {
	return { lineHeight: lineHeight ?? null };
}

export function blocksToDoc(blocks: readonly Block[]): PmNode {
	const content: PmNode[] = [];

	for (const block of blocks) {
		switch (block.type) {
			case "paragraph":
				content.push({
					type: "paragraph",
					attrs: {
						...alignToPm(block.align),
						...lineHeightToPm(block.lineHeight),
					},
					content: inlineToPm(block.content),
				});
				break;
			case "heading":
				content.push({
					type: "heading",
					attrs: {
						level: block.level,
						...alignToPm(block.align),
						...lineHeightToPm(block.lineHeight),
					},
					content: inlineToPm(block.content),
				});
				break;
			case "quote":
				content.push({
					type: "blockquote",
					content: [{ type: "paragraph", content: inlineToPm(block.content) }],
				});
				break;
			case "list":
				content.push({
					type: block.ordered ? "orderedList" : "bulletList",
					content: block.items.map((item) => ({
						type: "listItem",
						content: [{ type: "paragraph", content: inlineToPm(item) }],
					})),
				});
				break;
			case "image":
				content.push({
					type: "mediaImage",
					attrs: { mediaId: block.mediaId, caption: block.caption ?? "" },
				});
				break;
			case "embed":
				content.push({ type: "embed", attrs: { url: block.url } });
				break;
		}
	}

	// Um documento vazio ainda precisa de um parágrafo para o cursor existir.
	return {
		type: "doc",
		content: content.length > 0 ? content : [{ type: "paragraph" }],
	};
}

// --- Documento do editor → blocos do domínio -------------------------------

/**
 * Traduz as marcas do ProseMirror para as do domínio.
 *
 * Já foi um ACHATAMENTO com precedência (`link > strong > em`): o domínio só
 * comportava uma marca por trecho, e "negrito e sublinhado" voltava só negrito
 * — texto que se escreve de um jeito e reaparece de outro. Desde 08/09 o
 * domínio guarda um CONJUNTO, e este ponto deixou de perder informação. Ver
 * `body.ts`.
 *
 * Marca que o domínio não conhece é ignorada, e o texto segue: é o que
 * acontece com o que vem colado de fora com formatação que a barra não oferece.
 */
function pmToInline(nodes: readonly PmNode[] | undefined): InlineNode[] {
	const out: InlineNode[] = [];

	for (const node of nodes ?? []) {
		// Quebra de linha vira espaço: o domínio não tem esse conceito.
		if (node.type === "hardBreak") {
			const last = out.at(-1);
			if (last) {
				last.text = `${last.text} `;
			}
			continue;
		}
		if (node.type !== "text" || !node.text) {
			continue;
		}

		const pmMarks = node.marks ?? [];
		const marks = INLINE_MARKS.filter((mark) =>
			pmMarks.some((pm) => DOMAIN_MARK.get(pm.type) === mark),
		);
		const withMarks = marks.length > 0 ? { marks } : {};

		const link = pmMarks.find((mark) => mark.type === "link");
		if (link && typeof link.attrs?.href === "string") {
			out.push({
				type: "link",
				text: node.text,
				href: link.attrs.href,
				...withMarks,
			});
			continue;
		}

		out.push({ type: "text", text: node.text, ...withMarks });
	}

	return out;
}

function isBlank(nodes: readonly InlineNode[]): boolean {
	return nodes.every((node) => !node.text.trim());
}

/** O texto de um item de lista (que no PM é `listItem > paragraph`). */
function listItemInline(item: PmNode): InlineNode[] {
	const out: InlineNode[] = [];
	for (const child of item.content ?? []) {
		out.push(...pmToInline(child.content));
	}
	return out;
}

export function docToBlocks(doc: PmNode | null | undefined): Block[] {
	const blocks: Block[] = [];

	for (const node of doc?.content ?? []) {
		switch (node.type) {
			case "paragraph": {
				const content = pmToInline(node.content);
				// O TipTap SEMPRE mantém um parágrafo vazio no fim do documento, e
				// `Body.create` rejeita parágrafo sem texto. Sem este descarte, todo
				// autosave falharia com InvalidBlock.
				if (!isBlank(content)) {
					blocks.push({
						type: "paragraph",
						content,
						...alignToDomain(node.attrs),
						...lineHeightToDomain(node.attrs),
					});
				}
				break;
			}
			case "heading": {
				const content = pmToInline(node.content);
				const level = node.attrs?.level === 3 ? 3 : 2;
				if (!isBlank(content)) {
					blocks.push({
						type: "heading",
						level,
						content,
						...alignToDomain(node.attrs),
						...lineHeightToDomain(node.attrs),
					});
				}
				break;
			}
			case "blockquote": {
				const content: InlineNode[] = [];
				for (const child of node.content ?? []) {
					content.push(...pmToInline(child.content));
				}
				if (!isBlank(content)) {
					blocks.push({ type: "quote", content });
				}
				break;
			}
			case "bulletList":
			case "orderedList": {
				const items = (node.content ?? [])
					.map(listItemInline)
					.filter((item) => !isBlank(item));
				if (items.length > 0) {
					blocks.push({
						type: "list",
						ordered: node.type === "orderedList",
						items,
					});
				}
				break;
			}
			case "mediaImage": {
				const mediaId = node.attrs?.mediaId;
				const caption = node.attrs?.caption;
				if (typeof mediaId === "string" && mediaId) {
					blocks.push({
						type: "image",
						mediaId,
						...(typeof caption === "string" && caption ? { caption } : {}),
					});
				}
				break;
			}
			case "embed": {
				const url = node.attrs?.url;
				if (typeof url === "string" && /^https?:\/\/.+/.test(url.trim())) {
					blocks.push({ type: "embed", url: url.trim() });
				}
				break;
			}
		}
	}

	return blocks;
}
