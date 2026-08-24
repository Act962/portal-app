import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { MissingAltText } from "./errors";

/**
 * Texto alternativo — descrição da imagem para leitores de tela. Objeto de valor
 * não-vazio; a obrigatoriedade PARA IMAGENS é imposta pelo agregado `MediaAsset`
 * (A29). Vazio ⇒ `MissingAltText`.
 */
export class AltText extends ValueObject<{ value: string }> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw: string): Result<AltText, MissingAltText> {
		const value = raw.trim();
		if (!value) {
			return err(new MissingAltText());
		}
		return ok(new AltText(value));
	}

	get value(): string {
		return this.props.value;
	}
}
