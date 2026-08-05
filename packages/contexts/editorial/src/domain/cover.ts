import { ValueObject } from "@portal-app/shared-kernel";

/**
 * Capa — a imagem principal da matéria. Referencia um `MediaAsset` (do contexto
 * de mídia) por id e carrega o texto alternativo, porque a invariante de
 * publicação "capa com alt-text" precisa ser verificável sem sair do contexto
 * editorial. Referência por id, não o agregado de mídia — `contextos-isolados`.
 */
export class Cover extends ValueObject<{ mediaId: string; altText: string }> {
	private constructor(mediaId: string, altText: string) {
		super({ mediaId, altText });
	}

	static create(input: { mediaId: string; altText?: string | null }): Cover {
		return new Cover(input.mediaId.trim(), (input.altText ?? "").trim());
	}

	get mediaId(): string {
		return this.props.mediaId;
	}

	get altText(): string {
		return this.props.altText;
	}

	hasAltText(): boolean {
		return this.props.altText !== "";
	}
}
