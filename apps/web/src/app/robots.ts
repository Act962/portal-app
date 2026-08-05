import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * `/robots.txt`. Libera o portal e aponta o sitemap; barra a área autenticada
 * e a API, que não têm nada para um rastreador.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/dashboard", "/login", "/api/"],
		},
		sitemap: `${siteConfig.url}/sitemap.xml`,
		host: siteConfig.url,
	};
}
