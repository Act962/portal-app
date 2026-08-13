/**
 * A identidade do veículo do ponto de vista de quem indexa (spec 07, D1).
 *
 * Existe porque o portal tinha DUAS fontes para a mesma informação: o `<title>`
 * e o `og:*` da raiz já saíam do banco, enquanto canônicas de feed, sitemaps,
 * `robots.txt` e schema.org ainda liam `config/site.ts`. Trocar o domínio nas
 * Configurações produzia um portal que se declarava em dois domínios — e o
 * Google resolve esse conflito ignorando o site, sem nenhum aviso.
 *
 * Este módulo é PURO de propósito: recebe a configuração já lida e devolve a
 * identidade resolvida. Quem toca o banco é `load-site-identity.ts`. É o que
 * permite testar a normalização de URL e o fallback do logo sem Postgres.
 */

/** A arte do compartilhamento cadastrada nas Configurações. */
export type SocialImage = {
	url: string;
	width: number | null;
	height: number | null;
	alt: string;
};

/** O que este módulo precisa de `loadSiteSettings()` — nada além disso. */
export type SiteIdentitySource = {
	name: string;
	shortName: string;
	description: string;
	url: string;
	city: string;
	state: string;
	logoUrl: string | null;
	socialImage: SocialImage | null;
	contactEmail: string | null;
	contactNewsroom: string | null;
	contactAddress: string | null;
	social: { label: string; href: string }[];
};

export type SiteIdentity = {
	name: string;
	shortName: string;
	description: string;
	/** Origem canônica, **sem** barra final — todo caminho é concatenado nela. */
	url: string;
	/** BCP 47, para `inLanguage` e `<language>` do RSS. */
	locale: string;
	/** Só o idioma (`pt`), que é o formato do news-sitemap. */
	language: string;
	/** Logo do veículo em URL absoluta (schema.org e `<image>` do RSS exigem). */
	logoUrl: string;
	/**
	 * A arte do compartilhamento, quando o cliente cadastrou uma. É o `og:image`
	 * padrão de toda página que não tem imagem PRÓPRIA — matéria com capa e autor
	 * com foto continuam com as suas, que são mais específicas e valem mais no
	 * link compartilhado. Sem arte, cai no cartão gerado (spec 07, D4).
	 */
	socialImage: SocialImage | null;
	city: string;
	state: string;
	email: string | null;
	phone: string | null;
	address: string | null;
	/** Perfis oficiais, para o `sameAs` do schema.org. */
	sameAs: string[];
};

const LOCALE = "pt-BR";

/** O arquivo em `public/`, usado enquanto não há logo enviado pela mídia (D8). */
const FALLBACK_LOGO = "/brand/logo-7-cidades.png";

/**
 * Tira a barra final e qualquer espaço da URL configurada.
 *
 * Sem isto, um cliente que digita `https://fm7cidades.com/` no formulário faz o
 * portal emitir `https://fm7cidades.com//ultimas` em toda canônica — que é uma
 * URL DIFERENTE para o Google, e a duplicata inteira do site.
 */
export function normalizeOrigin(url: string): string {
	return url.trim().replace(/\/+$/, "");
}

export function siteIdentityFrom(source: SiteIdentitySource): SiteIdentity {
	const url = normalizeOrigin(source.url);
	const logoUrl = source.logoUrl ?? `${url}${FALLBACK_LOGO}`;

	return {
		name: source.name,
		shortName: source.shortName,
		description: source.description,
		url,
		locale: LOCALE,
		language: LOCALE.split("-")[0] as string,
		logoUrl,
		socialImage: source.socialImage,
		city: source.city,
		state: source.state,
		email: source.contactEmail,
		phone: source.contactNewsroom,
		address: source.contactAddress,
		// Só endereços absolutos: `sameAs` com caminho relativo é ignorado pelo
		// Google, e um campo vazio no formulário não pode virar `https://` solto.
		sameAs: source.social
			.map((link) => link.href.trim())
			.filter((href) => /^https?:\/\//.test(href)),
	};
}

/** Um caminho do portal (`/ultimas`) como URL absoluta. */
export function absoluteUrl(site: SiteIdentity, path: string): string {
	if (/^https?:\/\//.test(path)) {
		return path;
	}
	return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** `pt-BR` → `pt_BR`: o Open Graph usa sublinhado, não hífen. */
export function openGraphLocale(locale: string): string {
	return locale.replace("-", "_");
}
