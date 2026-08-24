import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidSlug } from "./errors";

type SlugProps = { value: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Slug da matéria — vai na URL `/{editoria}/{slug}`. Mesmo VO que a taxonomia
 * usa, DUPLICADO de propósito: contextos não compartilham modelo (regra
 * `contextos-isolados`), e o shared-kernel não carrega conceito de negócio. A
 * imutabilidade após publicar é imposta pelo agregado, não aqui.
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
