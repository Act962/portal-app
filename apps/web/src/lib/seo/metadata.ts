import type { Metadata } from "next";

import {
	absoluteUrl,
	openGraphLocale,
	type SiteIdentity,
} from "./site-identity";

/**
 * O único lugar que monta metadata de página no portal (spec 07, D2).
 *
 * Existe por causa de uma armadilha do Next: metadata de segmentos é mesclada
 * de forma RASA. Quando uma página declara `openGraph`, ela **substitui** o
 * objeto inteiro da raiz — `siteName`, `locale` e `type` somem do HTML e nada
 * quebra, nada avisa. Era o que acontecia em matéria, editoria, tag e autor.
 *
 * A saída não é "lembrar de repetir os campos": é ter um construtor que sempre
 * emite o Open Graph completo, para que a próxima página nasça certa sem
 * ninguém precisar saber da regra.
 *
 * Módulo PURO — recebe a identidade já resolvida e devolve o objeto. Testável
 * sem banco e sem montar componente.
 */

export type OgImage = {
	url: string;
	width?: number;
	height?: number;
	alt?: string;
};

/** Campos do `og:article`, quando a página é uma matéria. */
export type ArticleFacts = {
	publishedTime: string;
	modifiedTime: string;
	section: string;
	tags: string[];
	authorUrl: string;
};

export type PageMetadataInput = {
	site: SiteIdentity;
	/** Título da página; passa pelo template `%s | Nome` definido na raiz. */
	title?: string;
	/** Título que IGNORA o template — a home não quer "Início | Rádio 7 Cidades". */
	titleAbsolute?: string;
	description: string;
	/** Caminho canônico, já pronto (ver `canonicalFor`). */
	path: string;
	/** Rótulo pequeno impresso na imagem social gerada (ex.: "EDITORIA"). */
	eyebrow?: string;
	/** Imagem própria (capa da matéria, foto do autor). Sem isto, uma é gerada. */
	images?: OgImage[];
	type?: "website" | "profile";
	article?: ArticleFacts;
	/** `false` emite `noindex, follow`. Padrão: indexa. */
	index?: boolean;
	authors?: { name: string; url?: string }[];
	keywords?: string[];
	/** Feed RSS desta página, anunciado em `<link rel="alternate">`. */
	rss?: { path: string; title: string };
};

const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * O cartão social gerado (`/og`), usado por toda página que não tem imagem
 * própria (D4). O texto é truncado AQUI, e não na rota: quem monta a URL é
 * quem sabe o que cabe no cartão.
 */
const OG_TITLE_MAX = 90;
const OG_EYEBROW_MAX = 32;

function truncate(value: string, max: number): string {
	const clean = value.replace(/\s+/g, " ").trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function ogImageUrl(input: { title: string; eyebrow?: string }): string {
	const params = new URLSearchParams({
		title: truncate(input.title, OG_TITLE_MAX),
	});
	if (input.eyebrow) {
		params.set("eyebrow", truncate(input.eyebrow, OG_EYEBROW_MAX));
	}
	return `/og?${params.toString()}`;
}

/**
 * A canônica de uma listagem paginada (D3).
 *
 * A página 2 aponta para ela mesma, não para a 1. Apontar para a 1 diz ao Google
 * "isto é cópia": ele deixa de rastrear os links de lá, e as matérias que só
 * aparecem na página 2 perdem o único caminho interno que tinham.
 *
 * `?ordem=` NÃO entra: é a mesma lista noutra ordem, e cada ordenação viraria
 * uma URL concorrente da editoria.
 */
export function canonicalFor(path: string, page?: number): string {
	return page && page > 1 ? `${path}?page=${page}` : path;
}

function openGraphFor(
	input: PageMetadataInput,
	title: string,
	images: OgImage[],
): NonNullable<Metadata["openGraph"]> {
	const base = {
		siteName: input.site.name,
		locale: openGraphLocale(input.site.locale),
		url: absoluteUrl(input.site, input.path),
		title,
		description: input.description,
		images,
	};

	if (input.article) {
		return {
			...base,
			type: "article",
			publishedTime: input.article.publishedTime,
			modifiedTime: input.article.modifiedTime,
			section: input.article.section,
			tags: input.article.tags,
			authors: [input.article.authorUrl],
		};
	}
	if (input.type === "profile") {
		return { ...base, type: "profile" };
	}
	return { ...base, type: "website" };
}

export function pageMetadata(input: PageMetadataInput): Metadata {
	const title = input.titleAbsolute ?? input.title ?? input.site.name;
	const images: OgImage[] = input.images ?? [
		{
			url: ogImageUrl({
				title,
				eyebrow: input.eyebrow ?? input.site.shortName,
			}),
			...OG_IMAGE_SIZE,
			alt: `${title} — ${input.site.name}`,
		},
	];

	return {
		title: input.titleAbsolute
			? { absolute: input.titleAbsolute }
			: input.title,
		description: input.description,
		...(input.keywords && input.keywords.length > 0
			? { keywords: input.keywords }
			: {}),
		...(input.authors && input.authors.length > 0
			? { authors: input.authors }
			: {}),
		alternates: {
			canonical: input.path,
			...(input.rss
				? {
						types: {
							"application/rss+xml": [
								{ url: input.rss.path, title: input.rss.title },
							],
						},
					}
				: {}),
		},
		openGraph: openGraphFor(input, title, images),
		twitter: {
			card: "summary_large_image",
			title,
			description: input.description,
			images: images.map((image) => image.url),
		},
		...(input.index === false
			? { robots: { index: false, follow: true } }
			: {}),
	};
}

/**
 * Metadata de "conteúdo que não existe": a matéria/editoria/tag/autor apagada
 * ou nunca publicada.
 *
 * Sem isto o `generateMetadata` devolvia `{}` e a página de 404 herdava o título
 * da home. O `noindex` aqui é redundante — o Next já o injeta em resposta 404 —
 * e está explícito porque redundância barata em indexação é seguro barato.
 */
export function notFoundMetadata(): Metadata {
	return {
		title: "Página não encontrada",
		description:
			"O endereço pode ter mudado ou o conteúdo pode ter sido arquivado.",
		robots: { index: false, follow: true },
	};
}
