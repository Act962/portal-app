import { AggregateRoot, type Result, err, ok } from "@portal-app/shared-kernel";

import { InvalidColor, type InvalidSlug, MaxDepthExceeded, NameRequired, SectionInUse } from "./errors";
import { Slug } from "./slug";

export type SectionStatus = "ATIVA" | "INATIVA";

type SectionState = {
	name: string;
	slug: Slug;
	description: string;
	color: string | null;
	order: number;
	status: SectionStatus;
	parentId: string | null;
};

/** `#rgb` ou `#rrggbb` — a forma que a UI e o CSS entendem. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;

type CreateInput = {
	id: string;
	name: string;
	slug?: string;
	description?: string;
	color?: string | null;
	order?: number;
	/**
	 * A editoria-mãe, quando esta é uma subeditoria. Passar o agregado (não só o
	 * id) é o que permite impor o teto de dois níveis: uma mãe que já é filha é
	 * recusada aqui mesmo.
	 */
	parent?: Section | null;
};

/**
 * Editoria — o agregado raiz da taxonomia. Organiza o portal em seções
 * (`/politica`, `/esportes`) com hierarquia de no máximo dois níveis. Não se
 * exclui editoria que classifica conteúdo publicado: desativa-se (A17), o que
 * preserva a URL e o histórico.
 *
 * A unicidade do slug é regra de caso de uso (depende do repositório), não do
 * agregado; aqui ficam só as invariantes que o próprio dado sustenta.
 */
export class Section extends AggregateRoot<string> {
	private state: SectionState;

	private constructor(id: string, state: SectionState) {
		super(id);
		this.state = state;
	}

	static create(
		input: CreateInput,
	): Result<Section, NameRequired | InvalidSlug | InvalidColor | MaxDepthExceeded> {
		const name = input.name.trim();
		if (!name) {
			return err(new NameRequired("da editoria"));
		}

		// Sem slug explícito, deriva do nome (não-vazio ⇒ slug sempre válido); um
		// slug explícito mal-formado é recusado como InvalidSlug.
		const slugResult = Slug.create(input.slug ?? name);
		if (slugResult.isErr()) {
			return err(slugResult.error);
		}

		const color = normalizeColor(input.color);
		if (color.isErr()) {
			return err(color.error);
		}

		if (input.parent && !input.parent.isRoot()) {
			return err(new MaxDepthExceeded());
		}

		return ok(
			new Section(input.id, {
				name,
				slug: slugResult.value,
				description: (input.description ?? "").trim(),
				color: color.value,
				order: input.order ?? 0,
				status: "ATIVA",
				parentId: input.parent ? input.parent.id : null,
			}),
		);
	}

	/** Reidrata a partir da persistência (ou de um teste). Assume dado válido. */
	static restore(props: {
		id: string;
		name: string;
		slug: string;
		description?: string;
		color?: string | null;
		order: number;
		status: SectionStatus;
		parentId?: string | null;
	}): Section {
		const slug = Slug.create(props.slug);
		if (slug.isErr()) {
			throw slug.error;
		}
		return new Section(props.id, {
			name: props.name,
			slug: slug.value,
			description: props.description ?? "",
			color: props.color ?? null,
			order: props.order,
			status: props.status,
			parentId: props.parentId ?? null,
		});
	}

	get name(): string {
		return this.state.name;
	}

	get slug(): string {
		return this.state.slug.value;
	}

	get description(): string {
		return this.state.description;
	}

	get color(): string | null {
		return this.state.color;
	}

	get order(): number {
		return this.state.order;
	}

	get status(): SectionStatus {
		return this.state.status;
	}

	get parentId(): string | null {
		return this.state.parentId;
	}

	/** Editoria de primeiro nível — a única que pode ter subeditorias. */
	isRoot(): boolean {
		return this.state.parentId === null;
	}

	isActive(): boolean {
		return this.state.status === "ATIVA";
	}

	activate(): void {
		this.state = { ...this.state, status: "ATIVA" };
	}

	deactivate(): void {
		this.state = { ...this.state, status: "INATIVA" };
	}

	reorderTo(order: number): void {
		this.state = { ...this.state, order };
	}

	/**
	 * Edita nome, descrição e cor. O slug NÃO muda aqui: alterá-lo quebraria a URL
	 * pública, então ele é fixado na criação. Só toca o que vem no input.
	 */
	updateDetails(input: {
		name?: string;
		description?: string;
		color?: string | null;
	}): Result<void, NameRequired | InvalidColor> {
		const next = { ...this.state };

		if (input.name !== undefined) {
			const name = input.name.trim();
			if (!name) {
				return err(new NameRequired("da editoria"));
			}
			next.name = name;
		}

		if (input.description !== undefined) {
			next.description = input.description.trim();
		}

		if (input.color !== undefined) {
			const color = normalizeColor(input.color);
			if (color.isErr()) {
				return err(color.error);
			}
			next.color = color.value;
		}

		this.state = next;
		return ok(undefined);
	}

	/**
	 * Decide se a editoria pode ser excluída de vez. Recebe de fora (porta
	 * `SectionUsage`, ligada na Fase 3) se há conteúdo publicado usando-a — o
	 * agregado não conhece matérias, só a regra: em uso, só desativação.
	 */
	ensureDeletable(hasPublishedContent: boolean): Result<void, SectionInUse> {
		if (hasPublishedContent) {
			return err(new SectionInUse());
		}
		return ok(undefined);
	}
}

function normalizeColor(raw: string | null | undefined): Result<string | null, InvalidColor> {
	if (raw === null || raw === undefined || raw.trim() === "") {
		return ok(null);
	}
	const color = raw.trim().toLowerCase();
	if (!HEX_COLOR.test(color)) {
		return err(new InvalidColor(raw));
	}
	return ok(color);
}
