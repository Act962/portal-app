/**
 * As redes em que este portal publica. Duas, e as duas da Meta — é o recorte
 * que o cliente pediu, e é também o único par que compartilha uma API.
 *
 * A lista é fechada de propósito. Rede social nova não é um valor a mais num
 * enum: é outro conjunto de limites, outro formato de mídia e outro fluxo de
 * autenticação. Quando chegar a terceira, o compilador vai apontar cada lugar
 * que precisa de resposta — que é exatamente o que se quer.
 *
 * **Rede é CONTA, não destino.** É por rede que se conecta, se guarda o token e
 * se lê a cota (D5). Para onde um post vai — o feed ou os Stories — é o
 * `SocialDestination`, logo abaixo.
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
 * Para onde uma entrega vai: o feed de cada rede, ou os Stories do Instagram
 * (spec 08, §17).
 *
 * Stories é DESTINO, e não um tipo de post, pela mesma razão do D6: a redação
 * aprova uma vez e a notícia sai no feed e nos Stories — uma entrega para cada,
 * cada uma com seu `remoteId` e seu erro. Um story que falha não derruba o post
 * do feed, e o "tentar de novo" reenvia só ele.
 *
 * Os valores do feed têm o MESMO nome da rede. Não é coincidência: é o que
 * mantém válidas as entregas gravadas antes dos Stories existirem, sem
 * migration — `SocialPlatform` é um subconjunto deste tipo.
 */
export const SOCIAL_DESTINATIONS = [
	"INSTAGRAM",
	"INSTAGRAM_STORIES",
	"FACEBOOK",
] as const;

export type SocialDestination = (typeof SOCIAL_DESTINATIONS)[number];

export function isSocialDestination(value: string): value is SocialDestination {
	return (SOCIAL_DESTINATIONS as readonly string[]).includes(value);
}

/** Como o conteúdo aparece na rede. É o que o adapter precisa saber para
 * escolher a chamada — e só isso. */
export type PublicationFormat = "FEED" | "STORY";

/** A conta que publica em cada destino. */
export const DESTINATION_PLATFORM: Record<SocialDestination, SocialPlatform> = {
	INSTAGRAM: "INSTAGRAM",
	INSTAGRAM_STORIES: "INSTAGRAM",
	FACEBOOK: "FACEBOOK",
};

export const DESTINATION_FORMAT: Record<SocialDestination, PublicationFormat> =
	{
		INSTAGRAM: "FEED",
		INSTAGRAM_STORIES: "STORY",
		FACEBOOK: "FEED",
	};

/** Como o destino se chama na tela. */
export const DESTINATION_LABEL: Record<SocialDestination, string> = {
	INSTAGRAM: "Instagram",
	INSTAGRAM_STORIES: "Stories do Instagram",
	FACEBOOK: "Facebook",
};

/**
 * O destino de uma rede num formato — o caminho de volta de
 * `DESTINATION_PLATFORM` + `DESTINATION_FORMAT`. `null` quando a combinação não
 * existe (Stories do Facebook, hoje).
 */
export function destinationOf(
	platform: SocialPlatform,
	format: PublicationFormat,
): SocialDestination | null {
	return (
		SOCIAL_DESTINATIONS.find(
			(destination) =>
				DESTINATION_PLATFORM[destination] === platform &&
				DESTINATION_FORMAT[destination] === format,
		) ?? null
	);
}

/**
 * Quem põe a entrega no ar (spec 11, D1): o worker, pela API, ou uma pessoa,
 * pelo app da rede.
 *
 * Existe porque a API da Meta não publica figurinha nos Stories — nem a de
 * link. Story com link clicável só sai do app, e o portal prepara tudo o que não
 * é o toque na figurinha.
 */
export type DeliveryMode = "AUTOMATICO" | "MANUAL";

/**
 * O modo com que cada destino nasce (spec 11, D2). Os Stories nascem manuais: o
 * link é o que o cliente quer lá, e só o app o põe.
 */
export const DEFAULT_DELIVERY_MODE: Record<SocialDestination, DeliveryMode> = {
	INSTAGRAM: "AUTOMATICO",
	INSTAGRAM_STORIES: "MANUAL",
	FACEBOOK: "AUTOMATICO",
};

/**
 * Onde publicar à mão ganha alguma coisa. No feed, a API faz tudo o que o app
 * faz; oferecer o manual ali só abriria um jeito de esquecer um post na fila.
 */
export const ACCEPTS_MANUAL: Record<SocialDestination, boolean> = {
	INSTAGRAM: false,
	INSTAGRAM_STORIES: true,
	FACEBOOK: false,
};

/** O modo que vale para o destino: o pedido, se o destino aceita, senão o padrão. */
export function deliveryModeFor(
	destination: SocialDestination,
	requested?: DeliveryMode,
): DeliveryMode {
	if (requested === "MANUAL") {
		return ACCEPTS_MANUAL[destination] ? "MANUAL" : "AUTOMATICO";
	}
	return requested ?? DEFAULT_DELIVERY_MODE[destination];
}

/**
 * Os limites que a Meta impõe, declarados como DADO e não espalhados em `if`s.
 *
 * Eles moram no domínio porque são a régua que decide se um post pode ir ao ar —
 * a mesma pergunta que o agregado responde em `publicationBlockers()`. Se
 * vivessem no adapter HTTP, a redação só descobriria o estouro depois do erro
 * 400 da Meta, com o post já aprovado e a legenda já escrita.
 *
 * São por DESTINO, e não por rede: o feed e os Stories do Instagram usam a
 * mesma conta e respondem a réguas diferentes.
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
	/**
	 * A legenda vai junto?
	 *
	 * Nos Stories, não: a API de publicação não tem campo de texto para eles, e
	 * story com texto é texto DESENHADO na imagem. Sem este campo, a tela
	 * contaria caracteres de uma legenda que ninguém vai ler.
	 */
	publishesCaption: boolean;
	/**
	 * Quais imagens do post este destino usa.
	 *
	 * `FIRST` nos Stories: cada story é UMA imagem, e publicar um carrossel como
	 * vários stories em sequência deixaria um meio-publicado sem conserto — o
	 * terceiro falha, e o "tentar de novo" duplicaria os dois primeiros.
	 */
	images: "ALL" | "FIRST";
	/** A proporção em que a imagem é gerada para este destino. */
	imageAspect: "1:1" | "9:16";
};

export const PLATFORM_LIMITS: Record<SocialDestination, PlatformLimits> = {
	INSTAGRAM: {
		captionMaxLength: 2200,
		hashtagMaxCount: 30,
		mediaMaxCount: 10,
		carouselMinCount: 2,
		captionLinksAreClickable: false,
		publishesCaption: true,
		images: "ALL",
		imageAspect: "1:1",
	},
	INSTAGRAM_STORIES: {
		// Sem legenda, não há o que medir. Infinito, e não zero: zero faria toda
		// legenda "estourar" um destino que simplesmente não a publica.
		captionMaxLength: Number.POSITIVE_INFINITY,
		hashtagMaxCount: Number.POSITIVE_INFINITY,
		mediaMaxCount: 10,
		carouselMinCount: 2,
		captionLinksAreClickable: false,
		publishesCaption: false,
		images: "FIRST",
		imageAspect: "9:16",
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
		publishesCaption: true,
		images: "ALL",
		imageAspect: "1:1",
	},
};
