import { describe, expect, it } from "vitest";

import {
	absoluteUrl,
	normalizeOrigin,
	openGraphLocale,
	type SiteIdentitySource,
	siteIdentityFrom,
} from "@/lib/seo/site-identity";

const source: SiteIdentitySource = {
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
};

describe("normalizeOrigin", () => {
	it("tira a barra final", () => {
		// O cliente digita a URL num formulário, e "https://fm7cidades.com/" é o
		// que sai de um copiar-e-colar do navegador. Sem isto toda canônica vira
		// `https://fm7cidades.com//ultimas` — outra URL para o Google, e a
		// duplicata do site inteiro.
		expect(normalizeOrigin("https://fm7cidades.com/")).toBe(
			"https://fm7cidades.com",
		);
		expect(normalizeOrigin("https://fm7cidades.com///")).toBe(
			"https://fm7cidades.com",
		);
	});

	it("tira espaço em volta", () => {
		expect(normalizeOrigin("  https://fm7cidades.com  ")).toBe(
			"https://fm7cidades.com",
		);
	});

	it("deixa a URL já normalizada intacta", () => {
		expect(normalizeOrigin("https://fm7cidades.com")).toBe(
			"https://fm7cidades.com",
		);
	});
});

describe("siteIdentityFrom", () => {
	it("cai no logo de `public/` quando não há logo enviado", () => {
		// `logo` do schema.org e `<image>` do RSS exigem URL ABSOLUTA — um
		// caminho relativo aqui é ignorado em silêncio pelo validador.
		expect(siteIdentityFrom(source).logoUrl).toBe(
			"https://fm7cidades.com/brand/logo.svg",
		);
	});

	it("prefere o logo da biblioteca de mídia quando existe", () => {
		const identity = siteIdentityFrom({
			...source,
			logoUrl: "https://cdn.exemplo.com/logo.png",
		});
		expect(identity.logoUrl).toBe("https://cdn.exemplo.com/logo.png");
	});

	it("normaliza a URL antes de montar o logo", () => {
		const identity = siteIdentityFrom({ ...source, url: "https://x.com/" });
		expect(identity.url).toBe("https://x.com");
		expect(identity.logoUrl).toBe("https://x.com/brand/logo.svg");
	});

	it("descarta perfis que não são endereços absolutos", () => {
		// `sameAs` com caminho relativo é ignorado pelo Google, e o campo vazio do
		// formulário não pode virar um `https://` solto no payload.
		const identity = siteIdentityFrom({
			...source,
			social: [
				{ label: "Instagram", href: "https://instagram.com/fm7cidades" },
				{ label: "Nosso canal", href: "/canal" },
				{ label: "Vazio", href: "  " },
			],
		});
		expect(identity.sameAs).toEqual(["https://instagram.com/fm7cidades"]);
	});

	it("separa o idioma do locale para o news-sitemap", () => {
		const identity = siteIdentityFrom(source);
		expect(identity.locale).toBe("pt-BR");
		expect(identity.language).toBe("pt");
	});
});

describe("absoluteUrl", () => {
	const site = siteIdentityFrom(source);

	it("concatena o caminho na origem", () => {
		expect(absoluteUrl(site, "/ultimas")).toBe(
			"https://fm7cidades.com/ultimas",
		);
	});

	it("aceita caminho sem a barra inicial", () => {
		expect(absoluteUrl(site, "ultimas")).toBe("https://fm7cidades.com/ultimas");
	});

	it("devolve a URL absoluta como está", () => {
		// A capa vem do host do R2 e já é absoluta — prefixar produziria lixo.
		expect(absoluteUrl(site, "https://cdn.exemplo.com/foto.jpg")).toBe(
			"https://cdn.exemplo.com/foto.jpg",
		);
	});
});

describe("openGraphLocale", () => {
	it("troca o hífen pelo sublinhado", () => {
		// O Open Graph usa `pt_BR`; `pt-BR` é ignorado pelo Facebook.
		expect(openGraphLocale("pt-BR")).toBe("pt_BR");
	});
});
