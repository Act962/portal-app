import { type Result, ValueObject, err, ok } from "@portal-app/shared-kernel";

import { BylineRequired } from "./errors";

/**
 * Assinatura — quem escreve a matéria. Referencia o autor por id (o
 * `StaffMember` da identidade) e guarda o nome exibido. Referência por id, não o
 * agregado de outro contexto — mantém `contextos-isolados`.
 */
export class Byline extends ValueObject<{ authorId: string; name: string }> {
	private constructor(authorId: string, name: string) {
		super({ authorId, name });
	}

	static create(input: { authorId: string; name: string }): Result<Byline, BylineRequired> {
		const authorId = input.authorId.trim();
		const name = input.name.trim();
		if (!authorId || !name) {
			return err(new BylineRequired());
		}
		return ok(new Byline(authorId, name));
	}

	get authorId(): string {
		return this.props.authorId;
	}

	get name(): string {
		return this.props.name;
	}
}
