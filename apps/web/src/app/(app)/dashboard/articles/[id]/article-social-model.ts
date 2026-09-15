import {
	type ArtContent,
	type ArtDesign,
	type ArtFormat,
	type ArtInputs,
	type ArtSelection,
	type PostStatus,
	type SocialDestination,
	tokensIn,
} from "@portal-app/social";

/** Os textos da matéria que a prévia deixa editar, e a variável de cada um. */
const EDITABLE_CONTENT: readonly [keyof ArtContent, string][] = [
	["headline", "titulo"],
	["subtitle", "subtitulo"],
	["kicker", "chapeu"],
	["sectionName", "editoria"],
];

/**
 * Quais textos da matéria vale oferecer na prévia: só os que aparecem numa
 * caixa DINÂMICA visível de algum padrão escolhido.
 *
 * Caixa Editável já vira campo próprio (com o texto resolvido), então oferecer
 * também a variável dela seria o mesmo texto duas vezes. E variável que nenhuma
 * caixa usa não muda nada na arte — um campo que não faz efeito só confunde.
 */
export function relevantContentFields(
	designs: readonly ArtDesign[],
): (keyof ArtContent)[] {
	const used = new Set<string>();
	for (const design of designs) {
		for (const element of design.elements) {
			if (
				element.kind === "TEXT" &&
				element.mode === "DYNAMIC" &&
				element.visible
			) {
				for (const key of tokensIn(element.content)) {
					used.add(key);
				}
			}
		}
	}
	return EDITABLE_CONTENT.filter(([, token]) => used.has(token)).map(
		([field]) => field,
	);
}

/**
 * A lógica do cartão "Redes sociais" do editor da matéria (spec 09, F6), SEM
 * JSX e SEM React (regra de testes do projeto).
 *
 * O cartão prepara a publicação da matéria — destinos, padrão de cada um,
 * textos revisados na prévia, rascunho ou aprovada. As decisões que parecem
 * detalhe de tela e não são: o que vem marcado ao abrir, quando "sem padrão"
 * precisa ir EXPLÍCITO para o servidor, e quando dá para aprovar.
 */

/**
 * Os destinos que o editor da matéria oferece. O Facebook fica de fora enquanto
 * o veículo não tem Página conectada — oferecer levaria a uma entrega que falha.
 */
export const ARTICLE_SOCIAL_DESTINATIONS = [
	"INSTAGRAM",
	"INSTAGRAM_STORIES",
] as const satisfies readonly SocialDestination[];

/** O mínimo do post da matéria que o cartão lê. */
export type ArticlePostSummary = {
	status: PostStatus;
	deliveries: readonly { destination: SocialDestination }[];
	art: Readonly<
		Partial<
			Record<SocialDestination, { templateId: string } & Partial<ArtInputs>>
		>
	>;
};

export type DefaultTemplates = Readonly<
	Record<SocialDestination, { id: string; name: string } | null>
>;

/** O padrão escolhido por destino: um id, ou `null` para "sem padrão". */
export type TemplatePicks = Partial<Record<SocialDestination, string | null>>;

/** O que a redação preencheu nos campos da arte, por destino. */
export type InputsByDestination = Partial<Record<SocialDestination, ArtInputs>>;

const offered = (destination: SocialDestination) =>
	(ARTICLE_SOCIAL_DESTINATIONS as readonly SocialDestination[]).includes(
		destination,
	);

/**
 * Os destinos marcados ao abrir: os do post da matéria que o cartão oferece, se
 * ele existe; senão, o feed do Instagram — o foco do cliente.
 */
export function initialDestinations(
	post: ArticlePostSummary | null,
): SocialDestination[] {
	return post
		? post.deliveries.map((delivery) => delivery.destination).filter(offered)
		: ["INSTAGRAM"];
}

/**
 * O padrão marcado ao abrir, por destino.
 *
 * Com post existente, o que ELE tem — inclusive "sem padrão", que alguém
 * escolheu; trocar isso pelo padrão do destino desfaria uma decisão em
 * silêncio. Sem post, o padrão de cada destino, que é o que o gatilho
 * automático também usaria.
 */
export function initialPicks(
	post: ArticlePostSummary | null,
	defaults: DefaultTemplates,
): TemplatePicks {
	const picks: TemplatePicks = {};
	for (const destination of ARTICLE_SOCIAL_DESTINATIONS) {
		picks[destination] = post
			? (post.art[destination]?.templateId ?? null)
			: (defaults[destination]?.id ?? null);
	}
	return picks;
}

/** Os campos da arte que o post já tem, por destino. */
export function initialInputs(
	post: ArticlePostSummary | null,
): InputsByDestination {
	const inputs: InputsByDestination = {};
	for (const destination of ARTICLE_SOCIAL_DESTINATIONS) {
		const art = post?.art[destination];
		if (art) {
			inputs[destination] = {
				values: { ...(art.values ?? {}) },
				texts: { ...(art.texts ?? {}) },
			};
		}
	}
	return inputs;
}

/**
 * Os padrões a enviar, SÓ dos destinos marcados — e com "sem padrão" como
 * `null` explícito. Ausente, o servidor aplicaria o padrão do destino, e a
 * escolha "sem padrão" da pessoa seria ignorada.
 */
export function templatesInput(
	destinations: readonly SocialDestination[],
	picks: TemplatePicks,
): Partial<Record<SocialDestination, string | null>> {
	return Object.fromEntries(
		destinations.map((destination) => [
			destination,
			picks[destination] ?? null,
		]),
	);
}

/** Os campos da arte a enviar: só dos destinos marcados que têm padrão. */
export function inputsInput(
	destinations: readonly SocialDestination[],
	picks: TemplatePicks,
	inputs: InputsByDestination,
): InputsByDestination {
	const result: InputsByDestination = {};
	for (const destination of destinations) {
		const given = inputs[destination];
		if (picks[destination] && given) {
			result[destination] = given;
		}
	}
	return result;
}

/** O padrão como a tela o recebe da API. */
export type TemplateSummary = {
	id: string;
	name: string;
	version: number;
	format: ArtFormat;
	design: ArtDesign;
};

/**
 * A escolha de arte que o post teria com este padrão e estes campos — o que a
 * prévia desenha e o que `artFields` lê, ANTES de o post existir.
 */
export function selectionForPick(
	template: TemplateSummary,
	inputs: ArtInputs | undefined,
): ArtSelection {
	return {
		templateId: template.id,
		templateName: template.name,
		version: template.version,
		format: template.format,
		design: template.design,
		values: inputs?.values ?? {},
		texts: inputs?.texts ?? {},
	};
}

/** O conteúdo a enviar: campo opcional vazio é "sem valor", não texto vazio. */
export function contentInput(content: ArtContent): ArtContent {
	const clean = (value: string | null) => (value?.trim() ? value : null);
	return {
		...content,
		subtitle: clean(content.subtitle),
		kicker: clean(content.kicker),
		sectionName: clean(content.sectionName),
	};
}

/** O que da matéria entra na publicação — capa e textos da arte. */
export type ArticleForSocial = {
	headline: string;
	kicker: string;
	standfirst: string;
	sectionId: string | null;
	cover: { mediaId: string } | null;
};

/**
 * O salvamento da matéria mudou algo que a publicação mostra? É o que decide
 * refazer a consulta do cartão — sem isto, trocar a capa só aparecia na prévia
 * depois de recarregar a página. Só o que importa: o autosave roda a cada
 * pausa na digitação do corpo, e refazer a consulta a cada vez seria à toa.
 */
export function affectsSocialPreview(
	before: ArticleForSocial | undefined,
	after: ArticleForSocial,
): boolean {
	if (!before) {
		return true;
	}
	return (
		(before.cover?.mediaId ?? null) !== (after.cover?.mediaId ?? null) ||
		before.headline !== after.headline ||
		before.kicker !== after.kicker ||
		before.standfirst !== after.standfirst ||
		before.sectionId !== after.sectionId
	);
}

export type ArticleSocialState = {
	/** Dá para mexer nos destinos e padrões? */
	editable: boolean;
	/** O botão de aprovar vale? */
	canApprove: boolean;
	/** O que dizer abaixo dos botões, ou `null`. */
	hint: string | null;
};

/**
 * O que o cartão deixa fazer.
 *
 * Post já aprovado: nada — ele está a caminho das redes, e a fila é o lugar de
 * acompanhar. Matéria fora do ar: rascunho sim, aprovar não, porque o link
 * ainda não existe (é a mesma regra do servidor, dita antes do clique).
 */
export function articleSocialState(
	published: boolean,
	post: { status: PostStatus } | null,
): ArticleSocialState {
	const editable = !post || post.status === "RASCUNHO";
	if (!editable) {
		return {
			editable,
			canApprove: false,
			hint: "A publicação desta matéria já foi aprovada — acompanhe o envio na fila de Redes sociais.",
		};
	}
	if (!published) {
		return {
			editable,
			canApprove: false,
			hint: "Publique a matéria para aprovar a publicação nas redes. Até lá, dá para deixar o rascunho pronto.",
		};
	}
	return { editable, canApprove: true, hint: null };
}
