/**
 * Utilitários de XML para os feeds (sitemaps, news-sitemap, RSS).
 *
 * Os feeds são escritos à mão (e não pela convenção `MetadataRoute` do Next)
 * porque precisam de namespaces que ela não cobre — `news:` do Google News e o
 * RSS 2.0. O escape aqui é o que impede um `&` ou `<` num título de quebrar o
 * documento inteiro.
 */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Empacota um corpo XML numa `Response` com o cabeçalho e o prólogo certos. */
export function xmlResponse(body: string): Response {
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
		headers: {
			"content-type": "application/xml; charset=utf-8",
			// CDN/proxy podem cachear por 5 min; a Etapa 5 troca por revalidação.
			"cache-control":
				"public, max-age=0, s-maxage=300, stale-while-revalidate=600",
		},
	});
}
