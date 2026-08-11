import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidSlug } from "./errors";

type SlugProps = { value: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Endereço público do colunista — é o `/autor/{slug}` do portal.
 *
 * DUPLICADO de propósito do `Slug` do editorial e da taxonomia: contextos não
 * compartilham modelo (regra `contextos-isolados`), e o shared-kernel não
 * carrega conceito de negócio.
 *
 * A regra precisa continuar IDÊNTICA à do `slugify` do read model do portal
 * (`apps/web/src/data/read-model.ts`), porque é ela que amarra o colunista às
 * matérias que ele assina: o índice de autores é `slugify(authorName)`. Se as
 * duas divergirem, o perfil deixa de casar com a página — em silêncio, e sem
 * erro em lugar nenhum. Há teste fixando essa igualdade.
 */
export class Slug extends ValueObject<SlugProps> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw: string): Result<Slug, InvalidSlug> {
		const normalized = raw
			.normalize("NFD")
			.replace(DIACRITICS, "")
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		if (!SLUG_PATTERN.test(normalized)) {
			return err(new InvalidSlug(raw));
		}
		return ok(new Slug(normalized));
	}

	get value(): string {
		return this.props.value;
	}

	toString(): string {
		return this.props.value;
	}
}
