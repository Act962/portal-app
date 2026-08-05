import { type Result, ValueObject, err, ok } from "@portal-app/shared-kernel";

import { InvalidBlock } from "./errors";

/**
 * Blocos do corpo (D1/ADR 0003). União discriminada por `type`, validada no
 * domínio: o corpo é dado estruturado, não HTML — renderização controlada e
 * segura (sem `dangerouslySetInnerHTML`), e novos blocos entram sem migração.
 */
export type Block =
	| { type: "paragraph"; text: string }
	| { type: "heading"; level: 2 | 3; text: string }
	| { type: "image"; mediaId: string; caption?: string }
	| { type: "list"; ordered: boolean; items: string[] }
	| { type: "quote"; text: string; cite?: string }
	| { type: "embed"; url: string };

/**
 * Corpo da matéria — lista ordenada de blocos. Objeto de valor imutável; a
 * validação de cada bloco acontece na criação (`Result`, não exceção). Corpo
 * vazio é permitido no rascunho; a publicação é que exige corpo (invariante do
 * agregado).
 */
export class Body extends ValueObject<{ blocks: readonly Block[] }> {
	private constructor(blocks: readonly Block[]) {
		super({ blocks });
	}

	static empty(): Body {
		return new Body([]);
	}

	static create(blocks: readonly Block[]): Result<Body, InvalidBlock> {
		for (const block of blocks) {
			const problem = validate(block);
			if (problem) {
				return err(new InvalidBlock(problem));
			}
		}
		return ok(new Body([...blocks]));
	}

	get blocks(): readonly Block[] {
		return this.props.blocks;
	}

	isEmpty(): boolean {
		return this.props.blocks.length === 0;
	}
}

/** Devolve a razão da invalidez, ou `null` se o bloco é válido. */
function validate(block: Block): string | null {
	switch (block.type) {
		case "paragraph":
			return block.text.trim() ? null : "parágrafo sem texto";
		case "heading":
			if (block.level !== 2 && block.level !== 3) {
				return "título só aceita nível 2 ou 3";
			}
			return block.text.trim() ? null : "título sem texto";
		case "image":
			return block.mediaId.trim() ? null : "imagem sem mídia";
		case "list":
			if (block.items.length === 0) {
				return "lista sem itens";
			}
			return block.items.every((item) => item.trim() !== "") ? null : "lista com item vazio";
		case "quote":
			return block.text.trim() ? null : "citação sem texto";
		case "embed":
			return /^https?:\/\/.+/.test(block.url.trim()) ? null : "embed com URL inválida";
	}
}
