import { describe, expect, it } from "vitest";

import type { Article, Author } from "@/data/types";
import { siteIdentityFrom } from "@/lib/seo/site-identity";
import {
	articleListItems,
	breadcrumbSchema,
	collectionPageSchema,
	newsArticleSchema,
	organizationSchema,
	personSchema,
	websiteSchema,
} from "@/lib/structured-data";

const site = siteIdentityFrom({
	name: "Rádio 7 Cidades",
	shortName: "7 Cidades",
	description: "Notícias do Piauí.",
	url: "https://fm7cidades.com",
	city: "Piracuruca",
	state: "PI",
	logoUrl: null,
	contactEmail: "contato@fm7cidades.com",
	contactNewsroom: "(86) 3343-1107",
	contactAddress: "BR-343, km 140",
	social: [{ label: "Instagram", href: "https://instagram.com/fm7cidades" }],
});

const author: Author = {
	slug: "joao-gabriel",
	name: "João Gabriel",
	role: "Repórter",
	bio: "Cobre cidades desde 2019.",
	socials: { instagram: "https://instagram.com/joao" },
};

const article: Article = {
	slug: "chuva-alaga-br-343",
	title: "Chuva alaga trecho da BR-343 e interdita a pista",
	kicker: "TEMPO",
	standfirst: "Motoristas devem usar rota alternativa pela PI-112.",
	sectionSlug: "cidades",
	authorSlug: "joao-gabriel",
	publishedAt: "2026-08-13T09:00:00.000Z",
	updatedAt: "2026-08-13T11:30:00.000Z",
	readingMinutes: 3,
	coverCaption: "Trecho alagado",
	cover: {
		url: "https://cdn.exemplo.com/br343.jpg",
		alt: "Pista tomada pela água",
		focalX: 0.5,
		focalY: 0.4,
		width: 1600,
		height: 900,
	},
	tags: ["br-343", "chuva"],
	body: [],
};

describe("organizationSchema", () => {
	const schema = organizationSchema(site);

	it("publica endereço e ponto de contato", () => {
		// São os dados que alimentam o painel de conhecimento de um veículo LOCAL
		// — estavam nas Configurações e não chegavam a lugar nenhum do HTML.
		expect(schema.address).toMatchObject({
			"@type": "PostalAddress",
			streetAddress: "BR-343, km 140",
			addressLocality: "Piracuruca",
			addressRegion: "PI",
			addressCountry: "BR",
		});
		expect(schema.contactPoint).toMatchObject({
			telephone: "(86) 3343-1107",
			email: "contato@fm7cidades.com",
		});
	});

	it("usa a URL do banco, não uma cravada no código", () => {
		expect(schema.url).toBe("https://fm7cidades.com");
		expect(schema.logo.url).toBe("https://fm7cidades.com/brand/logo.svg");
	});

	it("omite endereço e telefone que o cliente não preencheu", () => {
		const semContato = organizationSchema(
			siteIdentityFrom({
				name: "X",
				shortName: "X",
				description: "…",
				url: "https://x.com",
				city: "Y",
				state: "PI",
				logoUrl: null,
				contactEmail: null,
				contactNewsroom: null,
				contactAddress: null,
				social: [],
			}),
		);
		expect(semContato).not.toHaveProperty("contactPoint");
		expect(semContato.address).not.toHaveProperty("streetAddress");
	});
});

describe("newsArticleSchema", () => {
	const url = "https://fm7cidades.com/cidades/chuva-alaga-br-343";
	const schema = newsArticleSchema({
		site,
		article,
		author,
		sectionName: "Cidades",
		url,
	});

	it("traz os campos que o Google trata como obrigatórios", () => {
		expect(schema).toMatchObject({
			"@type": "NewsArticle",
			datePublished: "2026-08-13T09:00:00.000Z",
			dateModified: "2026-08-13T11:30:00.000Z",
			articleSection: "Cidades",
			inLanguage: "pt-BR",
		});
		expect(schema.publisher.name).toBe("Rádio 7 Cidades");
		expect(schema.author).toMatchObject({
			name: "João Gabriel",
			url: "https://fm7cidades.com/autor/joao-gabriel",
		});
	});

	it("corta a manchete em 110 caracteres", () => {
		// É o limite do `headline`; acima disso o Google descarta o item inteiro.
		const longa = newsArticleSchema({
			site,
			article: { ...article, title: "A".repeat(200) },
			author,
			sectionName: "Cidades",
			url,
		});
		expect(longa.headline).toHaveLength(110);
	});

	it("emite a capa como `ImageObject` com dimensões", () => {
		expect(schema.image).toEqual([
			{
				"@type": "ImageObject",
				url: "https://cdn.exemplo.com/br343.jpg",
				width: 1600,
				height: 900,
				caption: "Pista tomada pela água",
			},
		]);
	});

	it("usa a data de publicação quando não houve atualização", () => {
		const semUpdate = newsArticleSchema({
			site,
			article: { ...article, updatedAt: undefined },
			author,
			sectionName: "Cidades",
			url,
		});
		expect(semUpdate.dateModified).toBe(semUpdate.datePublished);
	});

	it("aponta o `speakable` para os nós marcados no cabeçalho", () => {
		expect(schema.speakable.cssSelector).toEqual([
			'[data-speakable="headline"]',
			'[data-speakable="summary"]',
		]);
	});

	it("se liga ao `WebSite` pelo mesmo `@id` que a home emite", () => {
		// Se os dois divergirem, o grafo se parte em dois nós soltos e o Google
		// deixa de relacionar a matéria ao veículo.
		expect(schema.isPartOf["@id"]).toBe(websiteSchema(site)["@id"]);
	});
});

describe("personSchema", () => {
	it("liga a pessoa ao veículo pelo `@id` da organização", () => {
		const schema = personSchema({ site, author });
		expect(schema.mainEntity.url).toBe(
			"https://fm7cidades.com/autor/joao-gabriel",
		);
		expect(schema.mainEntity.worksFor["@id"]).toBe(
			organizationSchema(site)["@id"],
		);
		expect(schema.mainEntity.sameAs).toEqual(["https://instagram.com/joao"]);
	});
});

describe("breadcrumbSchema", () => {
	it("numera a partir de 1 e usa URLs absolutas", () => {
		const schema = breadcrumbSchema(site, [
			{ name: "Home", path: "/" },
			{ name: "Cidades", path: "/cidades" },
		]);
		expect(schema.itemListElement).toEqual([
			{
				"@type": "ListItem",
				position: 1,
				name: "Home",
				item: "https://fm7cidades.com/",
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Cidades",
				item: "https://fm7cidades.com/cidades",
			},
		]);
	});
});

describe("collectionPageSchema", () => {
	it("descreve a lista com a posição real dentro da paginação", () => {
		// Item 1 da página 2 é a posição 7 (a página tem 6), não a 1 — senão duas
		// URLs declaram ter o mesmo "primeiro item".
		const schema = collectionPageSchema({
			site,
			name: "Cidades",
			description: "Notícias de Cidades.",
			path: "/cidades?page=2",
			items: articleListItems([article]),
			offset: 6,
		});

		expect(schema.url).toBe("https://fm7cidades.com/cidades?page=2");
		expect(schema.mainEntity.numberOfItems).toBe(1);
		expect(schema.mainEntity.itemListElement[0]).toEqual({
			"@type": "ListItem",
			position: 7,
			name: article.title,
			url: "https://fm7cidades.com/cidades/chuva-alaga-br-343",
		});
	});

	it("começa na posição 1 sem offset", () => {
		const schema = collectionPageSchema({
			site,
			name: "Últimas",
			description: "…",
			path: "/ultimas",
			items: articleListItems([article]),
		});
		expect(schema.mainEntity.itemListElement[0]?.position).toBe(1);
	});
});
