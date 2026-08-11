import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { type InvalidSlug, NameRequired } from "./errors";
import { Slug } from "./slug";

type ColumnistState = {
	slug: Slug;
	name: string;
	beat: string;
	blurb: string;
	photoMediaId: string | null;
	order: number;
	active: boolean;
};

type CreateInput = {
	id: string;
	name: string;
	/** Só quando a assinatura difere do nome de exibição. Padrão: derivado do nome. */
	slug?: string;
	beat?: string;
	blurb?: string;
	photoMediaId?: string | null;
	order?: number;
};

type CreateError = NameRequired | InvalidSlug;

/**
 * Colunista — o agregado raiz do contexto.
 *
 * É CURADORIA, não conta: o registro diz quem aparece no bloco da home e com
 * que cara, e existe independentemente de a pessoa ter login. Por isso não há
 * papel, permissão nem e-mail aqui; isso é `identity`, e colunista de fora não
 * tem nada disso.
 *
 * O que o agregado guarda é o PERFIL de uma assinatura. As matérias continuam
 * do editorial, e a ligação entre os dois é o `slug` — nunca uma chave
 * estrangeira, porque a assinatura pode existir sem registro nenhum (o portal
 * degrada para "Redação") e o registro pode existir antes da primeira matéria.
 */
export class Columnist extends AggregateRoot<string> {
	private state: ColumnistState;

	private constructor(id: string, state: ColumnistState) {
		super(id);
		this.state = state;
	}

	static create(input: CreateInput): Result<Columnist, CreateError> {
		const name = input.name.trim();
		if (!name) {
			return err(new NameRequired());
		}

		// O slug sai do NOME por padrão, porque é assim que o portal indexa quem
		// assina — `slugify(authorName)`. Derivar de outra coisa criaria um
		// perfil que nunca casa com matéria nenhuma.
		const slug = Slug.create(input.slug ?? name);
		if (slug.isErr()) {
			return err(slug.error);
		}

		return ok(
			new Columnist(input.id, {
				slug: slug.value,
				name,
				beat: input.beat?.trim() ?? "",
				blurb: input.blurb?.trim() ?? "",
				photoMediaId: input.photoMediaId ?? null,
				order: input.order ?? 0,
				active: true,
			}),
		);
	}

	/** Reidrata a partir da persistência (ou de um teste). Assume dado válido. */
	static restore(props: {
		id: string;
		slug: string;
		name: string;
		beat: string;
		blurb: string;
		photoMediaId: string | null;
		order: number;
		active: boolean;
	}): Columnist {
		const slug = Slug.create(props.slug);
		if (slug.isErr()) {
			throw new Error(
				`Colunista persistido com endereço inválido: "${props.slug}".`,
			);
		}
		return new Columnist(props.id, {
			slug: slug.value,
			name: props.name,
			beat: props.beat,
			blurb: props.blurb,
			photoMediaId: props.photoMediaId,
			order: props.order,
			active: props.active,
		});
	}

	get slug(): string {
		return this.state.slug.value;
	}

	get name(): string {
		return this.state.name;
	}

	get beat(): string {
		return this.state.beat;
	}

	get blurb(): string {
		return this.state.blurb;
	}

	get photoMediaId(): string | null {
		return this.state.photoMediaId;
	}

	get order(): number {
		return this.state.order;
	}

	get isActive(): boolean {
		return this.state.active;
	}

	/**
	 * Edita o que é exibição. O `slug` NÃO está aqui, e é a regra que mais
	 * importa neste agregado: ele é o endereço público já indexado e a única
	 * ligação com as matérias assinadas. Trocá-lo órfãna as duas coisas de uma
	 * vez — a página `/autor/{slug}` some do Google e o perfil deixa de casar
	 * com o que a pessoa escreveu. Mesma decisão do endereço da editoria.
	 *
	 * Trocar o NOME é permitido e não mexe no slug: a pessoa passa a aparecer
	 * com o nome novo no bloco da home, e as matérias antigas seguem assinadas
	 * como estavam. Se a assinatura mudar de verdade, o caminho é outro
	 * registro.
	 */
	updateDetails(input: {
		name?: string;
		beat?: string;
		blurb?: string;
		photoMediaId?: string | null;
	}): Result<void, NameRequired> {
		const name = input.name !== undefined ? input.name.trim() : this.state.name;
		if (!name) {
			return err(new NameRequired());
		}

		this.state = {
			...this.state,
			name,
			beat: input.beat !== undefined ? input.beat.trim() : this.state.beat,
			blurb: input.blurb !== undefined ? input.blurb.trim() : this.state.blurb,
			photoMediaId:
				input.photoMediaId !== undefined
					? input.photoMediaId
					: this.state.photoMediaId,
		};
		return ok(undefined);
	}

	reorderTo(order: number): void {
		this.state = { ...this.state, order };
	}

	/**
	 * Tirar do ar sem apagar. Colunista em recesso volta; apagar o registro
	 * perderia foto, bio e a marca da coluna — e a página de autor continuaria
	 * existindo de qualquer forma, porque ela vem das matérias.
	 *
	 * Idempotente nos dois sentidos, como o `activate`/`deactivate` do staff.
	 */
	deactivate(): void {
		this.state = { ...this.state, active: false };
	}

	activate(): void {
		this.state = { ...this.state, active: true };
	}
}
