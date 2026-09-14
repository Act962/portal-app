import {
	type PostStatus,
	SOCIAL_DESTINATIONS,
	type SocialDestination,
} from "@portal-app/social";

/**
 * A lógica do cartão "Redes sociais" do editor da matéria (spec 09, F6), SEM
 * JSX e SEM React (regra de testes do projeto).
 *
 * O cartão prepara a publicação da matéria — destinos, padrão de cada um,
 * rascunho ou aprovada. As decisões que parecem detalhe de tela e não são: o
 * que vem marcado ao abrir, quando "sem padrão" precisa ir EXPLÍCITO para o
 * servidor, e quando dá para aprovar.
 */

/** O mínimo do post da matéria que o cartão lê. */
export type ArticlePostSummary = {
	status: PostStatus;
	deliveries: readonly { destination: SocialDestination }[];
	art: Readonly<Partial<Record<SocialDestination, { templateId: string }>>>;
};

export type DefaultTemplates = Readonly<
	Record<SocialDestination, { id: string; name: string } | null>
>;

/** O padrão escolhido por destino: um id, ou `null` para "sem padrão". */
export type TemplatePicks = Partial<Record<SocialDestination, string | null>>;

/**
 * Os destinos marcados ao abrir: os do post da matéria, se ele existe; senão,
 * o feed do Instagram — o foco do cliente —, e a pessoa marca o resto.
 */
export function initialDestinations(
	post: ArticlePostSummary | null,
): SocialDestination[] {
	return post
		? post.deliveries.map((delivery) => delivery.destination)
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
	for (const destination of SOCIAL_DESTINATIONS) {
		picks[destination] = post
			? (post.art[destination]?.templateId ?? null)
			: (defaults[destination]?.id ?? null);
	}
	return picks;
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
