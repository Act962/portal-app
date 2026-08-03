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

export type Author = {
	slug: string;
	name: string;
	role: string;
};

/** Inline run inside a paragraph. Mirrors the block editor's inline model. */
export type InlineNode =
	| { kind: "text"; text: string }
	| { kind: "strong"; text: string }
	| { kind: "link"; text: string; href: string };

/**
 * The article body is a list of blocks, never an HTML string — the decision
 * recorded in docs/stack.md (Decisão 5). The renderer below is what proves
 * the same content can later feed the app, the newsletter and partner feeds.
 */
export type ArticleBlock =
	| { kind: "paragraph"; content: InlineNode[] }
	| { kind: "subheading"; text: string }
	| { kind: "quote"; text: string; attribution?: string };

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

export type Columnist = {
	slug: string;
	name: string;
	beat: string;
	blurb: string;
	sectionSlug: string;
};

export type Program = {
	id: string;
	/** Display label, e.g. "06h". */
	hour: string;
	name: string;
	host: string;
	status?: "on-air" | "live";
};

export type TrackLogEntry = {
	at: string;
	title: string;
};

export type LiveShow = {
	name: string;
	host: string;
	schedule: string;
	listeners: number;
};

export type PollOption = {
	id: string;
	label: string;
	percentage: number;
};

export type Poll = {
	question: string;
	options: PollOption[];
	totalVotes: number;
};
