/**
 * As redes em que este portal publica. Duas, e as duas da Meta — é o recorte
 * que o cliente pediu, e é também o único par que compartilha uma API.
 *
 * A lista é fechada de propósito. Rede social nova não é um valor a mais num
 * enum: é outro conjunto de limites, outro formato de mídia e outro fluxo de
 * autenticação. Quando chegar a terceira, o compilador vai apontar cada lugar
 * que precisa de resposta — que é exatamente o que se quer.
 */
export const SOCIAL_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function isSocialPlatform(value: string): value is SocialPlatform {
	return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/** Como a rede se chama na tela. */
export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
	INSTAGRAM: "Instagram",
	FACEBOOK: "Facebook",
};

/**
 * Os limites que a Meta impõe, declarados como DADO e não espalhados em `if`s.
 *
 * Eles moram no domínio porque são a régua que decide se um post pode ir ao ar —
 * a mesma pergunta que o agregado responde em `publicationBlockers()`. Se
 * vivessem no adapter HTTP, a redação só descobriria o estouro depois do erro
 * 400 da Meta, com o post já aprovado e a legenda já escrita.
 *
 * Fonte: Instagram Platform · Content Publishing e Pages API (v25.0).
 */
export type PlatformLimits = {
	/** Caracteres da legenda. */
	captionMaxLength: number;
	/** Quantas hashtags a rede conta antes de recusar. */
	hashtagMaxCount: number;
	/** Quantas imagens cabem num post — 1 é foto simples, acima disso carrossel. */
	mediaMaxCount: number;
	/** Mínimo de imagens de um CARROSSEL (não do post). */
	carouselMinCount: number;
	/**
	 * Um link na legenda vira link clicável?
	 *
	 * No Instagram, NÃO: a legenda renderiza a URL como texto morto, e é por
	 * isso que o mundo inteiro escreve "link na bio". Este campo existe para o
	 * modelo de legenda padrão não despejar uma URL inútil ocupando 60 dos 2200
	 * caracteres.
	 */
	captionLinksAreClickable: boolean;
};

export const PLATFORM_LIMITS: Record<SocialPlatform, PlatformLimits> = {
	INSTAGRAM: {
		captionMaxLength: 2200,
		hashtagMaxCount: 30,
		mediaMaxCount: 10,
		carouselMinCount: 2,
		captionLinksAreClickable: false,
	},
	FACEBOOK: {
		// O limite real da Página é ordens de grandeza maior que qualquer post de
		// portal. Está aqui pela completude da régua, não porque alguém vá bater
		// nele.
		captionMaxLength: 63_206,
		// A Página não recusa por quantidade de hashtag. O número alto evita um
		// `null` que todo chamador teria de tratar.
		hashtagMaxCount: 1_000,
		mediaMaxCount: 10,
		carouselMinCount: 2,
		captionLinksAreClickable: true,
	},
};
