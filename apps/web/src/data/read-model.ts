import "server-only";
import { createPrismaClient } from "@portal-app/db";
import { cache } from "react";

import type { Article, ArticleBlock, Author, Section } from "./types";

/**
 * Read model público (Fase 4, D1). O portal lê AQUI — só matérias publicadas, já
 * denormalizadas (editoria/tags/autor resolvidos) — nunca o repositório do admin.
 * É este arquivo que substitui o corpo das fixtures: os componentes continuam
 * consumindo `queries.ts`, que agora delega para cá.
 *
 * `cache()` do React deduplica as leituras dentro de um mesmo render (uma query
 * por página, não por componente). RSC-only: o grupo `(site)` não tem providers.
 *
 * Defaults desta etapa (sem marcação de home ainda — P06 depois): a MANCHETE é a
 * publicada mais recente; destaques/últimas seguem por recência; "mais lidas"
 * entra na Etapa 5 (Redis).
 */
const prisma = createPrismaClient();

type SectionRow = { id: string; slug: string; name: string; description: string };
type EditorialBlock = { type: string; [key: string]: unknown };

/**
 * Toda leitura é tolerante a banco indisponível: no build do CI não há Postgres,
 * e em produção o portal deve degradar para "vazio" em vez de estourar (N03) —
 * o CDN/ISR continua servindo a última versão boa. Um erro só vira `warn`.
 */
async function safely<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await run();
	} catch (error) {
		console.warn(`[read-model] leitura "${what}" falhou; devolvendo vazio:`, error);
		return fallback;
	}
}

const loadSections = cache(
	async (): Promise<SectionRow[]> =>
		safely(
			"sections",
			() =>
				prisma.section.findMany({
					where: { status: "ATIVA" },
					orderBy: [{ order: "asc" }, { name: "asc" }],
					select: { id: true, slug: true, name: true, description: true },
				}),
			[],
		),
);

const loadTagSlugs = cache(async (): Promise<Map<string, string>> => {
	const rows = await safely(
		"tags",
		() => prisma.tag.findMany({ select: { id: true, slug: true } }),
		[] as { id: string; slug: string }[],
	);
	return new Map(rows.map((tag) => [tag.id, tag.slug]));
});

const loadPublished = cache(async (): Promise<Article[]> => {
	const [sections, tagSlugs] = await Promise.all([loadSections(), loadTagSlugs()]);
	const sectionById = new Map(sections.map((section) => [section.id, section]));
	const rows = await safely(
		"articles",
		() =>
			prisma.article.findMany({
				where: { status: { in: ["PUBLICADA", "ATUALIZADA"] } },
				orderBy: { publishedAt: "desc" },
			}),
		[] as ArticleRow[],
	);
	return rows.map((row, index) => mapArticle(row, sectionById, tagSlugs, index === 0));
});

// --- Seção -----------------------------------------------------------------

export async function getSections(): Promise<Section[]> {
	const rows = await loadSections();
	return rows.map((s) => ({ slug: s.slug, name: s.name, description: s.description }));
}

export async function getSection(slug: string): Promise<Section | undefined> {
	return (await getSections()).find((section) => section.slug === slug);
}

export async function getSectionName(slug: string): Promise<string> {
	return (await getSection(slug))?.name ?? slug;
}

// --- Listagens -------------------------------------------------------------

export async function getHeadline(): Promise<Article | undefined> {
	return (await loadPublished())[0];
}

export async function getSecondaryStories(limit = 3): Promise<Article[]> {
	return (await loadPublished()).filter((a) => !a.isHeadline).slice(0, limit);
}

export async function getLatest(limit = 6): Promise<Article[]> {
	const all = await loadPublished();
	const top = new Set([all[0]?.slug, ...all.slice(1, 4).map((a) => a.slug)]);
	return all.filter((a) => !top.has(a.slug)).slice(0, limit);
}

export async function getTicker(limit = 4): Promise<Article[]> {
	return (await loadPublished()).filter((a) => !a.isHeadline).slice(0, limit);
}

/** Sem contadores ainda (Etapa 5/Redis): "mais lidas" cai para as recentes. */
export async function getMostRead(): Promise<Article[]> {
	return (await loadPublished()).slice(0, 5);
}

export async function getArticlesBySection(sectionSlug: string): Promise<Article[]> {
	return (await loadPublished()).filter((a) => a.sectionSlug === sectionSlug);
}

export async function getArticle(sectionSlug: string, slug: string): Promise<Article | undefined> {
	return (await loadPublished()).find((a) => a.sectionSlug === sectionSlug && a.slug === slug);
}

export async function getRelated(article: Article, limit = 3): Promise<Article[]> {
	const all = await loadPublished();
	const sameSection = all.filter(
		(c) => c.slug !== article.slug && c.sectionSlug === article.sectionSlug,
	);
	const sharesTag = all.filter(
		(c) =>
			c.slug !== article.slug &&
			c.sectionSlug !== article.sectionSlug &&
			c.tags.some((tag) => article.tags.includes(tag)),
	);
	return [...sameSection, ...sharesTag].slice(0, limit);
}

export type HomeBlock = { section: Section; lead: Article; items: Article[] };

export async function getHomeBlocks(): Promise<HomeBlock[]> {
	const sections = await getSections();
	const all = await loadPublished();
	return sections.flatMap((section) => {
		const articles = all.filter((a) => a.sectionSlug === section.slug);
		const [lead, ...rest] = articles;
		return lead ? [{ section, lead, items: rest.slice(0, 3) }] : [];
	});
}

export async function searchArticles(query: string): Promise<Article[]> {
	const term = query.trim().toLowerCase();
	if (!term) {
		return [];
	}
	return (await loadPublished()).filter((a) =>
		[a.title, a.standfirst, a.kicker, ...a.tags].join(" ").toLowerCase().includes(term),
	);
}

export async function getAllArticles(): Promise<Article[]> {
	return loadPublished();
}

export async function getAuthor(slug: string): Promise<Author> {
	// A página de autor com bio/foto (E-E-A-T) liga no AuthorProfile na Etapa 3;
	// aqui o nome é derivado do slug, suficiente para a assinatura nas listagens.
	return { slug, name: deslug(slug), role: "Redação" };
}

// --- Mapeamento ------------------------------------------------------------

type ArticleRow = {
	slug: string;
	headline: string;
	kicker: string;
	standfirst: string;
	body: unknown;
	authorName: string;
	sectionId: string | null;
	tagIds: string[];
	coverAltText: string | null;
	status: string;
	publishedAt: Date | null;
	updatedAt: Date;
	createdAt: Date;
};

function mapArticle(
	row: ArticleRow,
	sectionById: Map<string, SectionRow>,
	tagSlugs: Map<string, string>,
	isHeadline: boolean,
): Article {
	const section = row.sectionId ? sectionById.get(row.sectionId) : undefined;
	const blocks = Array.isArray(row.body) ? (row.body as EditorialBlock[]) : [];
	return {
		slug: row.slug,
		title: row.headline,
		kicker: row.kicker,
		standfirst: row.standfirst,
		sectionSlug: section?.slug ?? "geral",
		authorSlug: slugify(row.authorName),
		publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
		updatedAt: row.status === "ATUALIZADA" ? row.updatedAt.toISOString() : undefined,
		readingMinutes: readingMinutes(blocks),
		coverCaption: row.coverAltText ?? "",
		tags: row.tagIds.map((id) => tagSlugs.get(id)).filter((s): s is string => Boolean(s)),
		body: mapBody(blocks),
		isHeadline: isHeadline || undefined,
	};
}

/** Mapeia os blocos do editorial para o formato reduzido do portal. Imagem/lista/
 * embed entram quando a página da matéria adotar o BlockRenderer real (Etapa 2). */
function mapBody(blocks: EditorialBlock[]): ArticleBlock[] {
	const out: ArticleBlock[] = [];
	for (const block of blocks) {
		if (block.type === "paragraph" && typeof block.text === "string") {
			out.push({ kind: "paragraph", content: [{ kind: "text", text: block.text }] });
		} else if (block.type === "heading" && typeof block.text === "string") {
			out.push({ kind: "subheading", text: block.text });
		} else if (block.type === "quote" && typeof block.text === "string") {
			out.push({ kind: "quote", text: block.text, attribution: block.cite as string | undefined });
		}
	}
	return out;
}

function readingMinutes(blocks: EditorialBlock[]): number {
	const words = blocks
		.map((b) => (typeof b.text === "string" ? b.text : Array.isArray(b.items) ? b.items.join(" ") : ""))
		.join(" ")
		.split(/\s+/)
		.filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replace(DIACRITICS, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function deslug(slug: string): string {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
