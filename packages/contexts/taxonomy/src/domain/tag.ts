import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { type InvalidSlug, NameRequired } from "./errors";
import { Slug } from "./slug";

type TagState = {
	name: string;
	slug: Slug;
};

/**
 * Tag — rótulo transversal às editorias (uma matéria em "política" e outra em
 * "esportes" podem compartilhar a tag "eleições-2026"). Agregado pequeno:
 * nome + slug. Renomear e mesclar duplicadas são casos de uso (Etapa 2); a
 * reatribuição das matérias de uma tag mesclada depende do Editorial (Fase 3).
 */
export class Tag extends AggregateRoot<string> {
	private state: TagState;

	private constructor(id: string, state: TagState) {
		super(id);
		this.state = state;
	}

	static create(input: {
		id: string;
		name: string;
		slug?: string;
	}): Result<Tag, NameRequired | InvalidSlug> {
		const name = input.name.trim();
		if (!name) {
			return err(new NameRequired("da tag"));
		}
		const slug = Slug.create(input.slug ?? name);
		if (slug.isErr()) {
			return err(slug.error);
		}
		return ok(new Tag(input.id, { name, slug: slug.value }));
	}

	/** Reidrata a partir da persistência (ou de um teste). Assume dado válido. */
	static restore(props: { id: string; name: string; slug: string }): Tag {
		const slug = Slug.create(props.slug);
		if (slug.isErr()) {
			throw slug.error;
		}
		return new Tag(props.id, { name: props.name, slug: slug.value });
	}

	get name(): string {
		return this.state.name;
	}

	get slug(): string {
		return this.state.slug.value;
	}

	rename(name: string): Result<void, NameRequired> {
		const next = name.trim();
		if (!next) {
			return err(new NameRequired("da tag"));
		}
		this.state = { ...this.state, name: next };
		return ok(undefined);
	}
}
