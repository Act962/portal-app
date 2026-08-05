import { type Result, ValueObject, err, ok } from "@portal-app/shared-kernel";

import { HeadlineRequired } from "./errors";

/**
 * Título da matéria — obrigatório desde o rascunho. Objeto de valor não-vazio.
 */
export class Headline extends ValueObject<{ value: string }> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw: string): Result<Headline, HeadlineRequired> {
		const value = raw.trim();
		if (!value) {
			return err(new HeadlineRequired());
		}
		return ok(new Headline(value));
	}

	get value(): string {
		return this.props.value;
	}
}
