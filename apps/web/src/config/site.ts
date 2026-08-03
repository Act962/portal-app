/** Everything about the outlet that is copy, not content. */
export const siteConfig = {
	name: "Rádio 7 Cidades",
	shortName: "7 Cidades",
	tagline: "NOTÍCIAS DO PIAUÍ · 93,9 FM",
	description:
		"Notícias do Piauí 24 horas no ar. Política, cidades, economia e esportes de Piracuruca e região, com a Rádio 7 Cidades 93,9 FM.",
	url: "https://fm7cidades.com",
	locale: "pt-BR",
	/**
	 * Swap this for the official artwork by dropping the file in
	 * `public/brand/` and pointing this at it — no component changes needed.
	 */
	logo: "/brand/logo.svg",
	city: "Piracuruca",
	state: "PI",
	radio: {
		frequency: "93,9 MHz",
		band: "93,9 FM",
		/** No stream wired up yet; the player renders its paused state. */
		streamUrl: null as string | null,
	},
	contact: {
		newsroom: "(86) 3343-1107",
		whatsapp: "(86) 9 9999-0000",
		email: "contato@fm7cidades.com",
		address: "BR-343, km 140 · Piracuruca",
	},
	social: [
		{ name: "Instagram", href: "https://instagram.com" },
		{ name: "Facebook", href: "https://facebook.com" },
		{ name: "YouTube", href: "https://youtube.com" },
	],
	institutional: [
		"Quem somos",
		"Anuncie na 7 Cidades",
		"Programação",
		"Locutores e colunistas",
		"Enquetes",
		"Fale com a redação",
	],
	legal: "PRINCÍPIOS EDITORIAIS · PRIVACIDADE · TERMOS DE USO",
	popularSearches: [
		"Concurso público",
		"Piracuruca",
		"Eleições 2026",
		"Vaquejada",
		"BR-343",
		"Programação",
	],
} as const;
