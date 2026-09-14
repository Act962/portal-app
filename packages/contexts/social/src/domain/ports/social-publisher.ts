import type { Result } from "@portal-app/shared-kernel";

import type { SocialPlatform } from "../platform";

/**
 * Uma imagem pronta para a Meta.
 *
 * `url` é público e obrigatório porque a API de publicação do Instagram **não
 * aceita upload de arquivo**: ela baixa a imagem de uma URL que os servidores da
 * Meta precisam alcançar. Quem resolve o id da biblioteca nessa URL é o
 * `SocialImageSource`, e é lá que mora a conversão para JPEG — o único formato
 * que o Instagram aceita.
 */
export type PublishableImage = {
	url: string;
	/** Texto alternativo. O Facebook o aceita (`alt_text_custom`); o Instagram
	 * ainda não o expõe na API de publicação, e lá ele é ignorado. Viaja mesmo
	 * assim, para o dia em que expuser. */
	altText: string;
};

export type PublishRequest = {
	platform: SocialPlatform;
	/** O id da conta NA META (`ig-user-id` ou `page-id`). */
	accountRemoteId: string;
	caption: string;
	/** Uma imagem é foto; duas ou mais, carrossel. */
	images: readonly PublishableImage[];
	/** Só o Facebook usa: no Instagram o link da legenda não é clicável. */
	linkUrl: string | null;
};

export type PublishSuccess = {
	/** `ig-media-id` ou `page-post-id` — a prova de que saiu. */
	remoteId: string;
	permalink: string | null;
};

/**
 * Por que a chamada falhou, já classificada.
 *
 * `retryable` é a única coisa que o domínio precisa saber sobre um erro da Meta,
 * e traduzi-lo é responsabilidade do adapter — quem conhece os códigos de erro
 * dela é ele. A distinção é cara de errar nos dois sentidos: repetir um "imagem
 * em formato inválido" queima a cota de 100 posts/24h sem chance de sucesso, e
 * desistir de um "tente novamente em instantes" descarta um post que teria ido
 * ao ar sozinho.
 */
export type PublishFailure = {
	/** Mensagem em português, pronta para a tela. */
	reason: string;
	retryable: boolean;
	/** O código de erro da Meta, preservado para o log e para quem for depurar
	 * com a documentação dela na mão. */
	providerCode?: string;
};

/**
 * A porta de saída para a rede social — o **único** lugar por onde este contexto
 * fala com o mundo.
 *
 * Ela é deliberadamente pequena e genérica: um `publish` que recebe legenda,
 * imagens e conta. Nada aqui menciona container, `creation_id`, `media_publish`
 * ou os dois passos do Instagram, porque essas são palavras da Meta, e o dia em
 * que o portal publicar também no Bluesky ou no WhatsApp Channels, nenhuma delas
 * fará sentido. O adapter é que sabe que, no Instagram, este `publish` custa
 * N+2 chamadas HTTP e uma espera de processamento.
 *
 * O teste de contrato (fake ↔ Meta) é o que garante que os dois se comportem
 * igual — mesmo arranjo que a Fase 2 usou em `MediaStorage`.
 */
export interface SocialPublisher {
	publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>>;
}

/**
 * Resolve um id da biblioteca de mídia na imagem que a Meta vai baixar.
 *
 * Existe como porta separada, e não como um campo a mais no `PublishRequest`,
 * porque as duas responsabilidades mudam por motivos diferentes: esta muda
 * quando o armazenamento ou o formato mudam (R2, JPEG, corte quadrado), aquela
 * quando a rede social muda.
 */
export interface SocialImageSource {
	/**
	 * @param mediaId id na biblioteca de mídia
	 * @param aspect proporção pedida — `"1:1"` é o quadrado do feed
	 */
	resolve(
		mediaId: string,
		aspect: "1:1" | "4:5" | "original",
	): Promise<PublishableImage | null>;
}
