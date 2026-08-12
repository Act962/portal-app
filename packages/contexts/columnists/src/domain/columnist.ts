import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	isValidEmail,
	normalizeEmail,
	normalizeSocials,
	type SocialLinks,
} from "./contact";
import {
	InvalidColumnistEmail,
	type InvalidSlug,
	NameRequired,
} from "./errors";
import { Slug } from "./slug";

type ColumnistState = {
	slug: Slug;
	name: string;
	beat: string;
	blurb: string;
	photoMediaId: string | null;
	socials: SocialLinks;
	email: string | null;
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
	socials?: SocialLinks;
	email?: string | null;
	order?: number;
};

type CreateError = NameRequired | InvalidSlug | InvalidColumnistEmail;

/**
 * Colunista — o agregado raiz do contexto.
 *
 * É CURADORIA, não conta: o registro diz quem aparece no bloco da home e com
 * que cara, e existe independentemente de a pessoa ter login. Por isso não há
 * papel nem permissão aqui; isso é `identity`, e colunista de fora não tem
 * nada disso.
 *
 * O `email` que existe aqui é de CONTATO PÚBLICO — o endereço que sai no
 * perfil para o leitor escrever. Não é credencial e não identifica conta: dois
 * colunistas podem publicar o mesmo e-mail da redação, e por isso ele não tem
 * unicidade. O e-mail de login mora no `identity`, e os dois nunca se cruzam.
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

		const email = parseEmail(input.email);
		if (email.isErr()) {
			return err(email.error);
		}

		return ok(
			new Columnist(input.id, {
				slug: slug.value,
				name,
				beat: input.beat?.trim() ?? "",
				blurb: input.blurb?.trim() ?? "",
				photoMediaId: input.photoMediaId ?? null,
				socials: normalizeSocials(input.socials ?? {}),
				email: email.value,
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
		socials?: SocialLinks;
		email?: string | null;
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
			// Reidratar não RECUSA — o portal não pode sair do ar por um campo
			// torto —, mas também não repassa lixo adiante: e-mail que não passa
			// na régua volta como `null`, e o perfil simplesmente não mostra a
			// linha de contato. O caminho de escrita já barra isso; isto aqui
			// cobre edição manual no banco e importação.
			socials: normalizeSocials(props.socials ?? {}),
			email: sanitizeStoredEmail(props.email),
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

	/** Cópia: o estado do agregado não sai por referência. */
	get socials(): SocialLinks {
		return { ...this.state.socials };
	}

	get email(): string | null {
		return this.state.email;
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
		socials?: SocialLinks;
		email?: string | null;
	}): Result<void, NameRequired | InvalidColumnistEmail> {
		const name = input.name !== undefined ? input.name.trim() : this.state.name;
		if (!name) {
			return err(new NameRequired());
		}

		// Valida ANTES de tocar no estado: uma edição que recusa o e-mail não
		// pode ter gravado o nome novo no caminho.
		const email =
			input.email !== undefined
				? parseEmail(input.email)
				: ok(this.state.email);
		if (email.isErr()) {
			return err(email.error);
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
			// Redes vêm INTEIRAS quando vêm: a tela edita o conjunto num
			// formulário só, e mesclar chave a chave tornaria impossível APAGAR
			// uma rede — o campo esvaziado chegaria como ausente e o valor antigo
			// sobreviveria.
			socials:
				input.socials !== undefined
					? normalizeSocials(input.socials)
					: this.state.socials,
			email: email.value,
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

/**
 * Caminho de ESCRITA do e-mail: ausente e vazio são a mesma coisa (`null`) —
 * limpar o campo na tela é como nunca ter preenchido —, e o que sobra passa
 * pela régua ou é recusado.
 */
function parseEmail(
	raw: string | null | undefined,
): Result<string | null, InvalidColumnistEmail> {
	if (raw === null || raw === undefined) {
		return ok(null);
	}
	const email = normalizeEmail(raw);
	if (!email) {
		return ok(null);
	}
	return isValidEmail(email) ? ok(email) : err(new InvalidColumnistEmail(raw));
}

/** Caminho de LEITURA: o que não passa na régua vira ausência, não erro. */
function sanitizeStoredEmail(raw: string | null | undefined): string | null {
	if (!raw) {
		return null;
	}
	const email = normalizeEmail(raw);
	return isValidEmail(email) ? email : null;
}
