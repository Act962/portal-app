import { ValueObject } from "@portal-app/shared-kernel";

/**
 * Legenda — o texto que aparece sob a imagem na matéria. Diferente do alt-text
 * (acessibilidade) e do crédito (autoria): é editorial e OPCIONAL. Nunca falha;
 * ausência vira string vazia.
 */
export class Caption extends ValueObject<{ value: string }> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw?: string | null): Caption {
		return new Caption((raw ?? "").trim());
	}

	get value(): string {
		return this.props.value;
	}

	isEmpty(): boolean {
		return this.props.value === "";
	}
}
