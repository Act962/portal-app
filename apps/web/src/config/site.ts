import { DEFAULT_SITE_SETTINGS } from "@portal-app/settings";

/**
 * Identidade do veículo — os DEFAULTS, não a fonte da verdade (spec 05b, D7).
 *
 * A fonte é o banco, lido por `loadSiteSettings()`. Este objeto é o que o portal
 * mostra antes da primeira edição, e o que preenche qualquer campo que o cliente
 * ainda não tocou. Os valores vêm de `DEFAULT_SITE_SETTINGS`, no contexto de
 * configurações, para que portal, painel e banco vazio concordem sobre o mesmo
 * ponto de partida — editar em dois lugares seria como esperar que não
 * divergissem.
 *
 * O formato aninhado (`radio.*`, `contact.*`) permanece porque os geradores de
 * SEO e de feed ainda consomem daqui; eles migram para o read model numa etapa
 * própria (registrada em `docs/pendencias.md`).
 */
const d = DEFAULT_SITE_SETTINGS;

export const siteConfig = {
	name: d.name,
	shortName: d.shortName,
	tagline: d.tagline,
	description: d.description,
	url: d.url,
	city: d.city,
	state: d.state,

	/** Não é configurável: é o arquivo em `public/`, usado enquanto não há logo
	 * enviado pela biblioteca de mídia (D8). */
	logo: "/brand/logo.svg",
	locale: "pt-BR",

	radio: {
		frequency: d.radioFrequency,
		band: d.radioBand,
		streamUrl: d.radioStreamUrl,
	},
	contact: {
		newsroom: d.contactNewsroom,
		whatsapp: d.contactWhatsapp,
		email: d.contactEmail,
		address: d.contactAddress,
	},
	social: d.social.map((link) => ({ name: link.label, href: link.href })),
	institutional: d.institutional,
	legal: d.legal,
	popularSearches: d.popularSearches,
} as const;
