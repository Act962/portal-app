import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { MissingCredit } from "./errors";

/**
 * Crédito — quem é a fonte/fotógrafo do arquivo. Objeto de valor obrigatório:
 * não existe asset sem crédito (A29). Vazio ⇒ `MissingCredit`.
 */
export class Credit extends ValueObject<{ value: string }> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw: string): Result<Credit, MissingCredit> {
		const value = raw.trim();
		if (!value) {
			return err(new MissingCredit());
		}
		return ok(new Credit(value));
	}

	get value(): string {
		return this.props.value;
	}
}
