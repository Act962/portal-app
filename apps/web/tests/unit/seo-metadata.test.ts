import { describe, expect, it } from "vitest";

import {
	canonicalFor,
	notFoundMetadata,
	ogImageUrl,
	pageMetadata,
} from "@/lib/seo/metadata";
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

/** O `openGraph` já resolvido, sem o `as` espalhado por cada teste. */
function og(metadata: ReturnType<typeof pageMetadata>) {
	return metadata.openGraph as Record<string, unknown>;
}

describe("pageMetadata", () => {
	it("emite o Open Graph COMPLETO em toda página", () => {
		/*
		 * O motivo de existir deste módulo. O Next mescla metadata de forma rasa:
		 * a página que declara `openGraph` substitui o objeto inteiro da raiz, e
		 * `siteName`/`locale`/`url` somem do HTML sem nada quebrar. Este teste é o
		 * que impede a regressão de voltar em silêncio.
		 */
		const meta = pageMetadata({
			site,
			title: "Últimas notícias",
			description: "Tudo o que foi publicado.",
			path: "/ultimas",
		});

		expect(og(meta)).toMatchObject({
			siteName: "Rádio 7 Cidades",
			locale: "pt_BR",
			type: "website",
			url: "https://fm7cidades.com/ultimas",
			title: "Últimas notícias",
			description: "Tudo o que foi publicado.",
		});
	});

	it("gera imagem social quando a página não tem uma própria", () => {
		// Sem isto o link do portal no WhatsApp sai sem imagem — o formato de
		// link que o leitor local mais vê.
		const images = og(
			pageMetadata({
				site,
				title: "Enquetes",
				description: "A enquete da semana.",
				path: "/enquetes",
				eyebrow: "Audiência",
			}),
		).images as { url: string; width: number; height: number }[];

		expect(images).toHaveLength(1);
		expect(images[0]?.url).toContain("/og?");
		expect(images[0]?.url).toContain("eyebrow=Audi%C3%AAncia");
		expect(images[0]?.width).toBe(1200);
		expect(images[0]?.height).toBe(630);
	});

	it("respeita a imagem própria da página", () => {
		const images = og(
			pageMetadata({
				site,
				title: "Matéria",
				description: "Linha fina.",
				path: "/geral/materia",
				images: [{ url: "https://cdn.exemplo.com/capa.jpg", width: 1600 }],
			}),
		).images as { url: string }[];

		expect(images[0]?.url).toBe("https://cdn.exemplo.com/capa.jpg");
	});

	it("monta o `og:article` com os campos da matéria", () => {
		const meta = pageMetadata({
			site,
			title: "Chuva alaga a BR-343",
			description: "Trecho interditado.",
			path: "/cidades/chuva-alaga",
			article: {
				publishedTime: "2026-08-13T09:00:00.000Z",
				modifiedTime: "2026-08-13T11:00:00.000Z",
				section: "Cidades",
				tags: ["br-343"],
				authorUrl: "https://fm7cidades.com/autor/joao",
			},
		});

		expect(og(meta)).toMatchObject({
			type: "article",
			section: "Cidades",
			publishedTime: "2026-08-13T09:00:00.000Z",
			modifiedTime: "2026-08-13T11:00:00.000Z",
			authors: ["https://fm7cidades.com/autor/joao"],
			// E continua com os campos da raiz que o merge raso apagaria.
			siteName: "Rádio 7 Cidades",
			locale: "pt_BR",
		});
	});

	it("usa o título absoluto sem passar pelo template", () => {
		// A home não pode virar "Início | Rádio 7 Cidades": é o `<title>` dela que
		// o Google costuma adotar como nome do site na SERP.
		const meta = pageMetadata({
			site,
			titleAbsolute: "Rádio 7 Cidades — Notícias de Piracuruca e região",
			description: "…",
			path: "/",
		});

		expect(meta.title).toEqual({
			absolute: "Rádio 7 Cidades — Notícias de Piracuruca e região",
		});
	});

	it("declara a canônica e o RSS da página", () => {
		const meta = pageMetadata({
			site,
			title: "Cidades",
			description: "…",
			path: "/cidades",
			rss: { path: "/cidades/rss.xml", title: "Cidades — RSS" },
		});

		expect(meta.alternates?.canonical).toBe("/cidades");
		expect(meta.alternates?.types?.["application/rss+xml"]).toEqual([
			{ url: "/cidades/rss.xml", title: "Cidades — RSS" },
		]);
	});

	it("indexa por padrão e só emite `noindex` quando pedido", () => {
		expect(
			pageMetadata({ site, title: "A", description: "…", path: "/a" }).robots,
		).toBeUndefined();

		expect(
			pageMetadata({
				site,
				title: "Busca",
				description: "…",
				path: "/busca",
				index: false,
			}).robots,
		).toEqual({ index: false, follow: true });
	});
});

describe("canonicalFor", () => {
	it("aponta a página paginada para ela mesma", () => {
		// Apontar a página 2 para a 1 diz ao Google "isto é cópia": ele deixa de
		// rastrear os links de lá, e as matérias que só aparecem na 2 ficam órfãs.
		expect(canonicalFor("/cidades", 2)).toBe("/cidades?page=2");
		expect(canonicalFor("/cidades", 7)).toBe("/cidades?page=7");
	});

	it("não escreve `?page=1` na primeira página", () => {
		expect(canonicalFor("/cidades", 1)).toBe("/cidades");
		expect(canonicalFor("/cidades")).toBe("/cidades");
	});

	it("nunca carrega a ordenação", () => {
		// `?ordem=` é a mesma lista noutra ordem; cada ordenação viraria uma URL
		// concorrente da própria editoria.
		expect(canonicalFor("/cidades", 2)).not.toContain("ordem");
	});
});

describe("ogImageUrl", () => {
	it("escapa o que vai na query", () => {
		const url = ogImageUrl({ title: "Chuva & vento na BR-343" });
		expect(url).toContain("Chuva+%26+vento");
		expect(url).not.toContain("&vento");
	});

	it("trunca a manchete longa", () => {
		const url = ogImageUrl({ title: "A".repeat(200) });
		const title = new URLSearchParams(url.split("?")[1]).get("title") ?? "";
		expect(title.length).toBeLessThanOrEqual(90);
		expect(title.endsWith("…")).toBe(true);
	});

	it("colapsa espaço e quebra de linha", () => {
		const url = ogImageUrl({ title: "  Duas   palavras \n aqui  " });
		expect(new URLSearchParams(url.split("?")[1]).get("title")).toBe(
			"Duas palavras aqui",
		);
	});

	it("omite o rótulo quando não há", () => {
		expect(ogImageUrl({ title: "Sem rótulo" })).not.toContain("eyebrow");
	});
});

describe("notFoundMetadata", () => {
	it("dá título próprio ao 404 e não o deixa indexável", () => {
		// Devolver `{}` fazia a página inexistente herdar o título da HOME.
		const meta = notFoundMetadata();
		expect(meta.title).toBe("Página não encontrada");
		expect(meta.robots).toEqual({ index: false, follow: true });
	});
});
