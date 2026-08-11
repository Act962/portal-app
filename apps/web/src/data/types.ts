/**
 * Shapes consumed by the portal UI.
 *
 * These mirror the read models the Editorial context will expose in Phase 4
 * (see docs/architecture.md §6). Keeping them here — rather than importing
 * persistence types — means swapping fixtures for real queries touches only
 * `queries.ts`, never a component.
 */

export type Section = {
	slug: string;
	name: string;
	description: string;
};

/** Redes sociais do autor (E-E-A-T). Espelha o VO `AuthorProfile` do `identity`. */
export type AuthorSocials = {
	twitter?: string;
	instagram?: string;
	linkedin?: string;
	website?: string;
};

export type Author = {
	slug: string;
	name: string;
	/** Cargo/função exibido na assinatura (ex.: "Repórter"). Vem do `title` do perfil. */
	role: string;
	/** Perfil público, quando o autor é um membro da redação com perfil preenchido. */
	bio?: string;
	photoUrl?: string | null;
	socials?: AuthorSocials;
};

/** Assunto (tag) já resolvido para o portal: rótulo + slug para a rota `/tag/{slug}`. */
export type Tag = {
	slug: string;
	name: string;
};

/** Inline run inside a paragraph. Mirrors the block editor's inline model. */
export type InlineNode =
	| { kind: "text"; text: string }
	| { kind: "strong"; text: string }
	| { kind: "em"; text: string }
	| { kind: "link"; text: string; href: string };

/**
 * The article body is a list of blocks, never an HTML string — the decision
 * recorded in docs/stack.md (Decisão 5). The renderer below is what proves
 * the same content can later feed the app, the newsletter and partner feeds.
 */
export type ArticleBlock =
	| { kind: "paragraph"; content: InlineNode[] }
	| { kind: "subheading"; text: string }
	| { kind: "quote"; text: string; attribution?: string }
	| { kind: "image"; url: string; alt: string; caption?: string }
	| { kind: "list"; ordered: boolean; items: string[] };

/** Imagem de capa já resolvida para o portal: URL pública + ponto focal. */
export type Cover = {
	url: string;
	alt: string;
	/** Fração [0,1] para o `object-position` no corte responsivo (P15/A32). */
	focalX: number;
	focalY: number;
};

export type Article = {
	slug: string;
	title: string;
	/** Short label above the headline, uppercase. */
	kicker: string;
	/** One-sentence summary under the headline. */
	standfirst: string;
	sectionSlug: string;
	authorSlug: string;
	publishedAt: string;
	updatedAt?: string;
	readingMinutes: number;
	coverCaption: string;
	/** Capa resolvida (URL + ponto focal); `null` quando a matéria não tem capa. */
	cover?: Cover | null;
	tags: string[];
	body: ArticleBlock[];
	/** Exactly one article carries this: the lead story on the home page. */
	isHeadline?: boolean;
	/** Ranked 1..5 for the "Mais lidas" panel. */
	mostReadRank?: number;
};

export type Video = {
	id: string;
	title: string;
	duration: string;
};

/**
 * Colunista em destaque na home. O `slug` é o da ASSINATURA — o cartão leva
 * para `/autor/{slug}`, que já lista as matérias da pessoa, tenha ela conta no
 * painel ou não. Antes o cartão apontava para a EDITORIA, e a página do
 * colunista ficava inalcançável a partir da home.
 */
export type Columnist = {
	slug: string;
	name: string;
	beat: string;
	blurb: string;
	photoUrl?: string;
};

// `LiveShow` e `TrackLogEntry` saíram junto com o player: a transmissão ao vivo
// não faz mais parte do produto (a rádio se desvinculou). A grade de programação
// continua, e o tipo dela é `ProgramView`, vindo do contexto `broadcast`.

// A enquete migrou para o banco no Bloco 5 — o tipo do portal agora é
// `PollView`, em `data/polls.ts` (a porcentagem é `number | null` lá, porque
// o resultado só chega depois do voto).
