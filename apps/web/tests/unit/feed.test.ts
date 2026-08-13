import { describe, expect, it } from "vitest";

import type { Article } from "@/data/types";
import {
	articleUrlEntry,
	latestModified,
	newsSitemap,
	rssFeed,
	sitemapIndex,
	urlset,
} from "@/lib/feed";
import { siteIdentityFrom } from "@/lib/seo/site-identity";

const site = siteIdentityFrom({
	name: "Rádio 7 Cidades",
	shortName: "7 Cidades",
	description: "Notícias do Piauí.",
	url: "https://fm7cidades.com",
	city: "Piracuruca",
	state: "PI",
	logoUrl: null,
	contactEmail: null,
	contactNewsroom: null,
	contactAddress: null,
	social: [],
});

function makeArticle(overrides: Partial<Article> = {}): Article {
	return {
		slug: "chuva-alaga-br-343",
		title: "Chuva alaga a BR-343",
		kicker: "TEMPO",
		standfirst: "Trecho interditado.",
		sectionSlug: "cidades",
		authorSlug: "joao-gabriel",
		publishedAt: "2026-08-13T09:00:00.000Z",
		readingMinutes: 3,
		coverCaption: "",
		tags: ["br-343"],
		body: [],
		...overrides,
	};
}

describe("latestModified", () => {
	it("devolve a data mais recente do conjunto", () => {
		expect(
			latestModified([
				makeArticle({ publishedAt: "2026-08-10T00:00:00.000Z" }),
				makeArticle({
					publishedAt: "2026-08-01T00:00:00.000Z",
					updatedAt: "2026-08-12T00:00:00.000Z",
				}),
			]),
		).toBe("2026-08-12T00:00:00.000Z");
	});

	it("devolve `undefined` para conjunto vazio — sem `lastmod` falso", () => {
		// Um `lastmod` de hoje numa editoria parada é `lastmod` mentiroso, e o
		// Google passa a ignorar o sitemap inteiro depois de algumas visitas.
		expect(latestModified([])).toBeUndefined();
	});
});

describe("rssFeed", () => {
	const xml = rssFeed({
		site,
		title: "Rádio 7 Cidades — Últimas notícias",
		description: "Notícias do Piauí.",
		path: "/rss.xml",
		articles: [
			makeArticle({
				title: "Chuva & vento na <BR-343>",
				cover: {
					url: "https://cdn.exemplo.com/br343.jpg",
					alt: "Pista alagada",
					focalX: 0.5,
					focalY: 0.5,
				},
			}),
		],
		authorNames: new Map([["joao-gabriel", "João Gabriel"]]),
	});

	it("escapa `&` e `<` do título", () => {
		// Um `&` cru num título quebra o documento inteiro para o agregador.
		expect(xml).toContain("Chuva &amp; vento na &lt;BR-343&gt;");
		expect(xml).not.toContain("Chuva & vento");
	});

	it("declara `lastBuildDate` e `ttl`", () => {
		// Sem eles cada leitor escolhe sozinho quando voltar — uns de minuto em
		// minuto, outros uma vez por dia.
		expect(xml).toContain("<lastBuildDate>");
		expect(xml).toContain("<ttl>15</ttl>");
	});

	it("assina o item com `dc:creator`, não com `<author>`", () => {
		// O `<author>` do RSS 2.0 exige e-mail, e publicar o endereço de cada
		// repórter num feed aberto é convite para spam.
		expect(xml).toContain("<dc:creator>João Gabriel</dc:creator>");
		expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
		expect(xml).not.toContain("<author>");
	});

	it("leva a capa como `enclosure` com o mime certo", () => {
		expect(xml).toContain(
			'<enclosure url="https://cdn.exemplo.com/br343.jpg" type="image/jpeg"',
		);
	});

	it("infere o mime pela extensão", () => {
		const png = rssFeed({
			site,
			title: "t",
			description: "d",
			path: "/rss.xml",
			articles: [
				makeArticle({
					cover: {
						url: "https://cdn.exemplo.com/a.png?v=2",
						alt: "",
						focalX: 0.5,
						focalY: 0.5,
					},
				}),
			],
		});
		expect(png).toContain('type="image/png"');
	});

	it("aponta o `atom:link rel=self` para a própria URL do feed", () => {
		expect(xml).toContain(
			'<atom:link href="https://fm7cidades.com/rss.xml" rel="self"',
		);
	});

	it("sobrevive ao feed vazio", () => {
		const vazio = rssFeed({
			site,
			title: "t",
			description: "d",
			path: "/rss.xml",
			articles: [],
		});
		expect(vazio).toContain("</rss>");
		expect(vazio).not.toContain("<lastBuildDate>");
	});
});

describe("urlset", () => {
	it("declara o namespace de imagem só quando há imagem", () => {
		const comImagem = urlset([
			articleUrlEntry(
				site,
				makeArticle({
					cover: {
						url: "https://cdn.exemplo.com/a.jpg",
						alt: "Legenda",
						focalX: 0.5,
						focalY: 0.5,
					},
				}),
			),
		]);
		expect(comImagem).toContain("xmlns:image=");
		expect(comImagem).toContain(
			"<image:loc>https://cdn.exemplo.com/a.jpg</image:loc>",
		);
		expect(comImagem).toContain("<image:caption>Legenda</image:caption>");

		const semImagem = urlset([articleUrlEntry(site, makeArticle())]);
		expect(semImagem).not.toContain("xmlns:image=");
		expect(semImagem).not.toContain("<image:image>");
	});

	it("usa o título como legenda quando a capa não tem alt", () => {
		const xml = urlset([
			articleUrlEntry(
				site,
				makeArticle({
					cover: {
						url: "https://cdn.exemplo.com/a.jpg",
						alt: "",
						focalX: 0.5,
						focalY: 0.5,
					},
				}),
			),
		]);
		expect(xml).toContain("<image:caption>Chuva alaga a BR-343</image:caption>");
	});

	it("usa `updatedAt` no `lastmod` quando a matéria foi corrigida", () => {
		const xml = urlset([
			articleUrlEntry(
				site,
				makeArticle({ updatedAt: "2026-08-14T10:00:00.000Z" }),
			),
		]);
		expect(xml).toContain("<lastmod>2026-08-14T10:00:00.000Z</lastmod>");
	});
});

describe("sitemapIndex", () => {
	it("leva `lastmod` por sitemap, e omite o de quem não tem", () => {
		const xml = sitemapIndex(site, [
			{ path: "/sitemap-geral.xml", lastmod: "2026-08-13T00:00:00.000Z" },
			{ path: "/cidades/sitemap.xml" },
		]);
		expect(xml).toContain(
			"<loc>https://fm7cidades.com/sitemap-geral.xml</loc>\n    <lastmod>2026-08-13T00:00:00.000Z</lastmod>",
		);
		expect(xml.match(/<lastmod>/g)).toHaveLength(1);
	});
});

describe("newsSitemap", () => {
	const now = new Date("2026-08-13T12:00:00.000Z");

	it("inclui só o que saiu nas últimas 48 h", () => {
		const xml = newsSitemap(
			site,
			[
				makeArticle({ slug: "recente", publishedAt: "2026-08-13T09:00:00.000Z" }),
				makeArticle({ slug: "antiga", publishedAt: "2026-08-09T09:00:00.000Z" }),
			],
			now,
		);
		expect(xml).toContain("/cidades/recente");
		expect(xml).not.toContain("/cidades/antiga");
	});

	it("mantém a matéria que está exatamente no limite", () => {
		const xml = newsSitemap(
			site,
			[makeArticle({ slug: "limite", publishedAt: "2026-08-11T12:00:00.000Z" })],
			now,
		);
		expect(xml).toContain("/cidades/limite");
	});

	it("não emite `news:keywords` nem `news:genres`", () => {
		// Os dois foram descontinuados pelo Google — seriam XML morto no feed.
		const xml = newsSitemap(site, [makeArticle()], now);
		expect(xml).not.toContain("news:keywords");
		expect(xml).not.toContain("news:genres");
	});

	it("usa só o idioma no `news:language`", () => {
		expect(newsSitemap(site, [makeArticle()], now)).toContain(
			"<news:language>pt</news:language>",
		);
	});
});
