import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidSlug } from "./errors";

type SlugProps = {
	value: string;
};

/** Um `-` só entre grupos alfanuméricos, sem pontas soltas. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Diacríticos combinantes (U+0300–U+036F), removidos após a decomposição NFD.
 * Construído de string ASCII para não carregar caracteres combinantes no fonte.
 */
const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Slug — o identificador legível que vai na URL (`/politica`, `/politica-local`).
 * Objeto de valor: minúsculas, kebab-case e sem acento. `create` NORMALIZA a
 * entrada (o admin digita "Política Local", o slug vira "politica-local") e só
 * falha quando não sobra nenhum caractere aproveitável — aí é `InvalidSlug`,
 * erro de domínio, não exceção.
 *
 * Unicidade NÃO é verificada aqui: depende do repositório (porta), então é
 * regra de caso de uso, não do valor em si.
 */
export class Slug extends ValueObject<SlugProps> {
	private constructor(value: string) {
		super({ value });
	}

	static create(raw: string): Result<Slug, InvalidSlug> {
		const normalized = normalize(raw);
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

/**
 * Apara, tira acento (decompõe em NFD e remove os diacríticos), baixa a caixa e
 * troca qualquer sequência não-alfanumérica por um hífen, sem hífens nas pontas.
 */
function normalize(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(DIACRITICS, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
