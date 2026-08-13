import type { MetadataRoute } from "next";

import { loadSiteIdentity } from "@/lib/seo/load-site-identity";

/**
 * `/robots.txt`. Libera o portal e aponta os sitemaps; barra a área
 * autenticada, a API e o espaço de rastreio que não vira página indexável.
 *
 * O `Disallow` das ordenações e da busca (spec 07, D6) não é redundante com o
 * `noindex` daquelas páginas: `noindex` só age DEPOIS do rastreio, e cada
 * `?ordem=` é uma cópia a mais da editoria consumindo orçamento de rastreio que
 * deveria ir para as matérias.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
	const site = await loadSiteIdentity();

	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: [
				"/dashboard",
				"/login",
				"/reset-password",
				"/api/",
				// Espaço de rastreio infinito: uma URL por termo digitado.
				"/busca",
				// Duplicata da navegação que já está no cabeçalho e no rodapé.
				"/menu",
				// A mesma listagem noutra ordem — canonicaliza para a base (D3).
				"/*?ordem=",
			],
		},
		sitemap: [
			`${site.url}/sitemap.xml`,
			// O news-sitemap também no índice, mas repetido aqui: é o feed que o
			// Google News lê, e é o primeiro a ser procurado numa auditoria manual.
			`${site.url}/news-sitemap.xml`,
		],
		host: site.url,
	};
}
