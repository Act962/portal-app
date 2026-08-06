import "server-only";
import {
	articleDeps,
	dispatchEditorialEvents,
} from "@portal-app/api/editorial";
import { createPrismaClient } from "@portal-app/db";
import { publishDueScheduled } from "@portal-app/editorial";
import { env } from "@portal-app/env/server";
import { SiteSettings, type SiteSettingsData } from "@portal-app/settings";
import { cache } from "react";

import type {
	Article,
	ArticleBlock,
	Author,
	AuthorSocials,
	Cover,
	InlineNode,
	Section,
	Tag,
} from "./types";

/** Um asset de mídia já resolvido para o portal (URL pública + foco). */
type MediaInfo = {
	url: string;
	alt: string;
	caption: string;
	focalX: number;
	focalY: number;
};

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

/**
 * Configuração do veículo (spec 05b). Uma consulta por render, deduplicada pelo
 * `cache()` — o cabeçalho, o rodapé e a barra do topo pedem os mesmos dados.
 *
 * Linha ausente não é caso especial: `fromStored` mescla sobre os defaults (D7),
 * então um banco recém-migrado serve o portal completo. É por isso que esta
 * função não devolve `null` e ninguém precisa tratar "ainda não configurado".
 */
export const loadSiteSettings = cache(
	async (): Promise<SiteSettingsData & { logoUrl: string | null }> => {
		// `safely` como todos os outros loaders: o build do CI prerenderiza SEM
		// banco, e sem esta tolerância a página inteira quebra na geração. O
		// fallback `null` cai nos defaults pelo `fromStored` (D7) — que é
		// exatamente o comportamento desejado quando não há de onde ler.
		const row = await safely(
			"site-settings",
			() => prisma.siteSettings.findUnique({ where: { id: SiteSettings.ID } }),
			null,
		);
		const data = SiteSettings.fromStored(row).data;

		// O agregado guarda o ID da mídia, não a URL (D8) — resolver é trabalho da
		// leitura, e a biblioteca já está em cache neste render.
		const logoUrl = data.logoMediaId
			? ((await loadMedia()).get(data.logoMediaId)?.url ?? null)
			: null;

		return { ...data, logoUrl };
	},
);

type SectionRow = {
	id: string;
	slug: string;
	name: string;
	description: string;
};
type EditorialBlock = { type: string; [key: string]: unknown };

/**
 * Toda leitura é tolerante a banco indisponível: no build do CI não há Postgres,
 * e em produção o portal deve degradar para "vazio" em vez de estourar (N03) —
 * o CDN/ISR continua servindo a última versão boa. Um erro só vira `warn`.
 */
async function safely<T>(
	what: string,
	run: () => Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		console.warn(
			`[read-model] leitura "${what}" falhou; devolvendo vazio:`,
			error,
		);
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

type TagRow = { id: string; slug: string; name: string };

const loadTagRows = cache(
	async (): Promise<TagRow[]> =>
		safely(
			"tags",
			() =>
				prisma.tag.findMany({ select: { id: true, slug: true, name: true } }),
			[] as TagRow[],
		),
);

const loadTagSlugs = cache(async (): Promise<Map<string, string>> => {
	const rows = await loadTagRows();
	return new Map(rows.map((tag) => [tag.id, tag.slug]));
});

/** Perfil público do autor (colunas achatadas do `AuthorProfile`), por id do staff. */
type StaffProfile = {
	title: string;
	bio: string;
	photoUrl: string | null;
	socials: AuthorSocials;
};

const loadStaff = cache(async (): Promise<Map<string, StaffProfile>> => {
	const rows = await safely(
		"staff",
		() =>
			prisma.staffMember.findMany({
				where: { status: "ATIVO" },
				select: {
					id: true,
					title: true,
					bio: true,
					photoUrl: true,
					socials: true,
				},
			}),
		[] as {
			id: string;
			title: string;
			bio: string;
			photoUrl: string | null;
			socials: unknown;
		}[],
	);
	return new Map(
		rows.map((s) => [
			s.id,
			{
				title: s.title,
				bio: s.bio,
				photoUrl: s.photoUrl,
				socials: (s.socials ?? {}) as AuthorSocials,
			},
		]),
	);
});

/**
 * Índice de autores derivado das matérias publicadas: slug → {nome, id do staff}.
 * O slug do autor no portal vem de `slugify(authorName)` (a assinatura por valor
 * na matéria); o `authorId` liga na tabela do staff para enriquecer com o perfil.
 * Como as linhas vêm ordenadas por recência, a primeira ocorrência de cada slug
 * carrega o nome mais recente.
 */
type AuthorIndexEntry = { slug: string; name: string; authorId: string };

const loadAuthorIndex = cache(
	async (): Promise<Map<string, AuthorIndexEntry>> => {
		const rows = await safely(
			"author-index",
			() =>
				prisma.article.findMany({
					where: { status: { in: ["PUBLICADA", "ATUALIZADA"] } },
					orderBy: { publishedAt: "desc" },
					select: { authorId: true, authorName: true },
				}),
			[] as { authorId: string; authorName: string }[],
		);
		const index = new Map<string, AuthorIndexEntry>();
		for (const row of rows) {
			const slug = slugify(row.authorName);
			if (!index.has(slug)) {
				index.set(slug, { slug, name: row.authorName, authorId: row.authorId });
			}
		}
		return index;
	},
);

const PUBLIC_BASE = env.S3_PUBLIC_URL.replace(/\/+$/, "");

const loadMedia = cache(async (): Promise<Map<string, MediaInfo>> => {
	const rows = await safely(
		"media",
		() =>
			prisma.mediaAsset.findMany({
				select: {
					id: true,
					storageKey: true,
					altText: true,
					caption: true,
					focalX: true,
					focalY: true,
				},
			}),
		[] as {
			id: string;
			storageKey: string;
			altText: string | null;
			caption: string;
			focalX: number | null;
			focalY: number | null;
		}[],
	);
	return new Map(
		rows.map((m) => [
			m.id,
			{
				url: `${PUBLIC_BASE}/${m.storageKey}`,
				alt: m.altText ?? "",
				caption: m.caption,
				focalX: m.focalX ?? 0.5,
				focalY: m.focalY ?? 0.5,
			},
		]),
	);
});

/**
 * Rede de segurança do agendamento: publica o que já venceu, na hora de ler.
 *
 * O gatilho oficial é o cron (`/api/cron/publish-scheduled`). Este aqui existe
 * porque agendamento é uma promessa feita ao jornalista, e ela não pode depender
 * de UMA peça de infraestrutura estar de pé: cron não configurado, plano da
 * hospedagem que só aceita cron diário, serviço externo fora do ar, troca de
 * biblioteca no meio do caminho — em qualquer um desses casos a matéria marcada
 * para as 6h continua saindo.
 *
 * Fica no caminho de leitura de propósito. Como roda ANTES de listar, a matéria
 * que acabou de vencer aparece no MESMO render — não há intervalo entre publicar
 * e estar no ar. O custo é uma consulta indexada por revalidação (no máximo uma
 * por página por minuto, pelo `revalidate = 60`), e nada é escrito quando não há
 * nada vencido.
 *
 * Limite conhecido, e aceitável: sem tráfego nenhum, nada revalida e nada
 * publica. Um portal sem visitante também não tem quem veja a matéria — e o cron
 * cobre justamente esse caso.
 *
 * `safely` mantém a regra da casa: falha aqui não derruba a página, e o build
 * sem banco continua passando.
 */
const publishDueScheduledOnRead = cache(async (): Promise<void> => {
	await safely(
		"publicar-agendadas",
		async () => {
			const published = await publishDueScheduled(articleDeps);
			if (published.length > 0) {
				// Sem isto os eventos ficariam parados no outbox e a auditoria não
				// registraria a publicação.
				await dispatchEditorialEvents();
			}
			return published.length;
		},
		0,
	);
});

const loadPublished = cache(async (): Promise<Article[]> => {
	await publishDueScheduledOnRead();

	const [sections, tagSlugs, media] = await Promise.all([
		loadSections(),
		loadTagSlugs(),
		loadMedia(),
	]);
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
	return rows.map((row, index) =>
		mapArticle(row, sectionById, tagSlugs, media, index === 0),
	);
});

// --- Seção -----------------------------------------------------------------

export async function getSections(): Promise<Section[]> {
	const rows = await loadSections();
	return rows.map((s) => ({
		slug: s.slug,
		name: s.name,
		description: s.description,
	}));
}

export async function getSection(slug: string): Promise<Section | undefined> {
	return (await getSections()).find((section) => section.slug === slug);
}

export async function getSectionName(slug: string): Promise<string> {
	return (await getSection(slug))?.name ?? slug;
}

// --- Tags ------------------------------------------------------------------

export async function getTags(): Promise<Tag[]> {
	const rows = await loadTagRows();
	return rows
		.map((tag) => ({ slug: tag.slug, name: tag.name }))
		.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getTag(slug: string): Promise<Tag | undefined> {
	return (await getTags()).find((tag) => tag.slug === slug);
}

export async function getArticlesByTag(slug: string): Promise<Article[]> {
	return (await loadPublished()).filter((article) =>
		article.tags.includes(slug),
	);
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

export async function getArticlesBySection(
	sectionSlug: string,
): Promise<Article[]> {
	return (await loadPublished()).filter((a) => a.sectionSlug === sectionSlug);
}

export async function getArticle(
	sectionSlug: string,
	slug: string,
): Promise<Article | undefined> {
	return (await loadPublished()).find(
		(a) => a.sectionSlug === sectionSlug && a.slug === slug,
	);
}

export async function getRelated(
	article: Article,
	limit = 3,
): Promise<Article[]> {
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
		[a.title, a.standfirst, a.kicker, ...a.tags]
			.join(" ")
			.toLowerCase()
			.includes(term),
	);
}

export async function getAllArticles(): Promise<Article[]> {
	return loadPublished();
}

/**
 * Autor resolvido para o portal (E-E-A-T, P10). O nome vem do índice de autores
 * (a assinatura das matérias); bio/foto/cargo/redes vêm do `AuthorProfile` do
 * `identity`, lido aqui direto das colunas do staff (lado de leitura, sem passar
 * pelos agregados). Autor sem perfil (ou fora da lista) degrada para o nome só.
 */
export async function getAuthor(slug: string): Promise<Author> {
	const [index, staff] = await Promise.all([loadAuthorIndex(), loadStaff()]);
	const entry = index.get(slug);
	if (!entry) {
		return { slug, name: deslug(slug), role: "Redação" };
	}
	const profile = staff.get(entry.authorId);
	return {
		slug,
		name: entry.name,
		role: profile?.title || "Redação",
		bio: profile?.bio || undefined,
		photoUrl: profile?.photoUrl ?? undefined,
		socials: profile?.socials,
	};
}

export async function getAuthors(): Promise<Author[]> {
	const index = await loadAuthorIndex();
	return Promise.all([...index.keys()].map((slug) => getAuthor(slug)));
}

export async function getArticlesByAuthor(slug: string): Promise<Article[]> {
	return (await loadPublished()).filter(
		(article) => article.authorSlug === slug,
	);
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
	coverMediaId: string | null;
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
	media: Map<string, MediaInfo>,
	isHeadline: boolean,
): Article {
	const section = row.sectionId ? sectionById.get(row.sectionId) : undefined;
	const blocks = Array.isArray(row.body) ? (row.body as EditorialBlock[]) : [];
	const coverMedia = row.coverMediaId ? media.get(row.coverMediaId) : undefined;
	const cover: Cover | null = coverMedia
		? {
				url: coverMedia.url,
				alt: row.coverAltText || coverMedia.alt,
				focalX: coverMedia.focalX,
				focalY: coverMedia.focalY,
			}
		: null;
	return {
		slug: row.slug,
		title: row.headline,
		kicker: row.kicker,
		standfirst: row.standfirst,
		sectionSlug: section?.slug ?? "geral",
		authorSlug: slugify(row.authorName),
		publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
		updatedAt:
			row.status === "ATUALIZADA" ? row.updatedAt.toISOString() : undefined,
		readingMinutes: readingMinutes(blocks),
		coverCaption: cover?.alt ?? "",
		cover,
		tags: row.tagIds
			.map((id) => tagSlugs.get(id))
			.filter((s): s is string => Boolean(s)),
		body: mapBody(blocks, media),
		isHeadline: isHeadline || undefined,
	};
}

/**
 * Converte o conteúdo de um bloco de texto para os nós inline do portal.
 *
 * Tolera os DOIS formatos, porque aqui se lê o JSON do Prisma sem passar pelo
 * domínio: `content` (ADR 0010, com negrito/itálico/link) e `text` (o formato
 * anterior, texto puro). Sem esta tolerância o portal perderia parágrafos em
 * silêncio nas matérias antigas.
 */
function mapInline(block: EditorialBlock): InlineNode[] {
	if (Array.isArray(block.content)) {
		const out: InlineNode[] = [];
		for (const raw of block.content) {
			const node = raw as { type?: string; text?: unknown; href?: unknown };
			if (typeof node.text !== "string" || !node.text) {
				continue;
			}
			if (node.type === "link" && typeof node.href === "string") {
				out.push({ kind: "link", text: node.text, href: node.href });
			} else if (node.type === "strong") {
				out.push({ kind: "strong", text: node.text });
			} else if (node.type === "em") {
				out.push({ kind: "em", text: node.text });
			} else {
				out.push({ kind: "text", text: node.text });
			}
		}
		return out;
	}
	if (typeof block.text === "string" && block.text) {
		return [{ kind: "text", text: block.text }];
	}
	return [];
}

/** Texto corrido de um bloco, nos dois formatos. */
function plainOf(block: EditorialBlock): string {
	return mapInline(block)
		.map((node) => node.text)
		.join("");
}

/** Mapeia os blocos do editorial para os blocos do portal, resolvendo a URL das
 * imagens. Embed vira um parágrafo com link (reusa o nó inline existente). */
function mapBody(
	blocks: EditorialBlock[],
	media: Map<string, MediaInfo>,
): ArticleBlock[] {
	const out: ArticleBlock[] = [];
	for (const block of blocks) {
		if (block.type === "paragraph") {
			const content = mapInline(block);
			if (content.length > 0) {
				out.push({ kind: "paragraph", content });
			}
		} else if (block.type === "heading") {
			const text = plainOf(block);
			if (text) {
				out.push({ kind: "subheading", text });
			}
		} else if (block.type === "quote") {
			const text = plainOf(block);
			if (text) {
				out.push({
					kind: "quote",
					text,
					attribution: block.cite as string | undefined,
				});
			}
		} else if (block.type === "image" && typeof block.mediaId === "string") {
			const info = media.get(block.mediaId);
			if (info) {
				out.push({
					kind: "image",
					url: info.url,
					alt: info.alt,
					caption:
						(block.caption as string | undefined) || info.caption || undefined,
				});
			}
		} else if (block.type === "list" && Array.isArray(block.items)) {
			const items = block.items
				.map((item) =>
					typeof item === "string"
						? item
						: mapInline({ type: "paragraph", content: item })
								.map((node) => node.text)
								.join(""),
				)
				.filter((item) => item.trim() !== "");
			if (items.length > 0) {
				out.push({ kind: "list", ordered: Boolean(block.ordered), items });
			}
		} else if (block.type === "embed" && typeof block.url === "string") {
			out.push({
				kind: "paragraph",
				content: [{ kind: "link", text: block.url, href: block.url }],
			});
		}
	}
	return out;
}

function readingMinutes(blocks: EditorialBlock[]): number {
	const words = blocks
		.map((block) => {
			if (Array.isArray(block.items)) {
				return block.items
					.map((item) =>
						typeof item === "string"
							? item
							: plainOf({ type: "paragraph", content: item }),
					)
					.join(" ");
			}
			// `plainOf` cobre os dois formatos (content e text). Sem isto, uma
			// matéria no formato novo contaria zero palavras.
			return plainOf(block);
		})
		.join(" ")
		.split(/\s+/)
		.filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}

const DIACRITICS = /[\u0300-\u036f]/g;

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
