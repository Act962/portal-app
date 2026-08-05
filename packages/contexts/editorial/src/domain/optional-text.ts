import { ValueObject } from "@portal-app/shared-kernel";

/**
 * Base dos textos editoriais OPCIONAIS — chapéu (kicker) e linha fina
 * (standfirst). Nunca falham; ausência vira string vazia. São VOs distintos
 * (classes próprias) para o domínio não confundir um chapéu com uma linha fina.
 */
abstract class OptionalText extends ValueObject<{ value: string }> {
	protected constructor(value: string) {
		super({ value });
	}

	get value(): string {
		return this.props.value;
	}

	isEmpty(): boolean {
		return this.props.value === "";
	}
}

/** Chapéu — a etiqueta curta acima do título (ex.: "ELEIÇÕES 2026"). */
export class Kicker extends OptionalText {
	static create(raw?: string | null): Kicker {
		return new Kicker((raw ?? "").trim());
	}
}

/** Linha fina — a frase de apoio abaixo do título. */
export class Standfirst extends OptionalText {
	static create(raw?: string | null): Standfirst {
		return new Standfirst((raw ?? "").trim());
	}
}
