import type { Block, InlineNode } from "@portal-app/editorial";

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

function inlineToPm(nodes: readonly InlineNode[]): PmNode[] {
	return nodes
		.filter((node) => node.text)
		.map((node) => {
			if (node.type === "strong") {
				return { type: "text", text: node.text, marks: [{ type: "bold" }] };
			}
			if (node.type === "em") {
				return { type: "text", text: node.text, marks: [{ type: "italic" }] };
			}
			if (node.type === "link") {
				return {
					type: "text",
					text: node.text,
					marks: [{ type: "link", attrs: { href: node.href } }],
				};
			}
			return { type: "text", text: node.text };
		});
}

export function blocksToDoc(blocks: readonly Block[]): PmNode {
	const content: PmNode[] = [];

	for (const block of blocks) {
		switch (block.type) {
			case "paragraph":
				content.push({ type: "paragraph", content: inlineToPm(block.content) });
				break;
			case "heading":
				content.push({
					type: "heading",
					attrs: { level: block.level },
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
 * Achata as marcas do ProseMirror para a união plana do domínio.
 *
 * O ProseMirror permite marcas combinadas (`[bold, link]` no mesmo trecho); o
 * `InlineNode` não. A precedência é `link > strong > em`, e a perda está
 * registrada no ADR 0010 — um modelo aninhado complicaria domínio, validação e
 * dois renderizadores para um ganho editorial marginal.
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

		const marks = node.marks ?? [];
		const link = marks.find((mark) => mark.type === "link");
		if (link && typeof link.attrs?.href === "string") {
			out.push({ type: "link", text: node.text, href: link.attrs.href });
			continue;
		}
		if (marks.some((mark) => mark.type === "bold")) {
			out.push({ type: "strong", text: node.text });
			continue;
		}
		if (marks.some((mark) => mark.type === "italic")) {
			out.push({ type: "em", text: node.text });
			continue;
		}
		out.push({ type: "text", text: node.text });
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
					blocks.push({ type: "paragraph", content });
				}
				break;
			}
			case "heading": {
				const content = pmToInline(node.content);
				const level = node.attrs?.level === 3 ? 3 : 2;
				if (!isBlank(content)) {
					blocks.push({ type: "heading", level, content });
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
