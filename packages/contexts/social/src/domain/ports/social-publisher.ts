import type { Result } from "@portal-app/shared-kernel";

import type { CropAspect } from "../focal-crop";
import type { PublicationFormat, SocialPlatform } from "../platform";
import type { ArtSelection } from "../template/art-selection";
import type { ArtContent } from "../template/variables";
import type { VideoSequence } from "../video";

/** O que o desenhista precisa para a arte de um destino (spec 09, F5). */
export type ArtworkRequest = {
	/** A cópia do padrão guardada no post, com os textos trocados. */
	selection: ArtSelection;
	/** A primeira foto do post; `null` num post sem foto. */
	photoMediaId: string | null;
	/** O que preenche as caixas de texto. */
	content: ArtContent;
};

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

/**
 * Um vídeo pronto para a Meta — o padrão já queimado sobre ele.
 *
 * Mesma razão da `PublishableImage` para a URL pública: a API de publicação
 * **não aceita upload de arquivo**, ela BAIXA de `video_url`. A diferença é o
 * peso: um Reels de 90 s tem dezenas de megabytes, e os servidores da Meta
 * levam minutos processando — é por isso que a espera pelo container tem um
 * teto próprio no adapter, e não o mesmo da foto.
 *
 * `coverUrl` é a capa. Opcional porque a Meta escolhe um quadro sozinha quando
 * ela falta; quando vem, é o primeiro quadro do vídeo já com o padrão — que é o
 * que a redação viu na prévia e espera ver na grade do perfil.
 */
export type PublishableVideo = {
	url: string;
	coverUrl: string | null;
	altText: string;
};

export type PublishRequest = {
	/** A rede — é ela que decide a conta e o token. */
	platform: SocialPlatform;
	/** Feed ou story. No story vai UMA imagem e a legenda é ignorada (§17). */
	format: PublicationFormat;
	/** O id da conta NA META (`ig-user-id` ou `page-id`). */
	accountRemoteId: string;
	caption: string;
	/** Uma imagem é foto; duas ou mais, carrossel. Vazio num post de vídeo. */
	images: readonly PublishableImage[];
	/** O vídeo, quando o post é de vídeo. Nesse caso `images` vem vazio. */
	video?: PublishableVideo | null;
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
/** O que o renderizador precisa para montar o vídeo de um destino (spec 12). */
export type VideoArtworkRequest = ArtworkRequest & {
	/** Os trechos escolhidos, na ordem em que vão ao ar. */
	clips: VideoSequence;
};

/**
 * Monta o vídeo que a Meta vai baixar: o trecho escolhido dentro do padrão.
 *
 * Porta separada da `SocialImageSource`, e não um método a mais nela, porque as
 * duas mudam por motivos diferentes e têm custos de outra ordem — esta depende
 * de um transcodificador, leva dezenas de segundos e tem teto de duração; a
 * outra desenha um JPEG em milissegundos. Juntá-las obrigaria todo dublê de
 * teste de imagem a fingir que sabe transcodificar.
 */
export interface SocialVideoSource {
	/**
	 * Mesmo contrato do `artwork`: `null` quando o arquivo não existe mais —
	 * erro definitivo para a entrega —, e falha passageira LANÇA, para a entrega
	 * ficar pendente e a próxima rodada tentar de novo.
	 */
	artwork(request: VideoArtworkRequest): Promise<PublishableVideo | null>;
}

export interface SocialImageSource {
	/**
	 * @param mediaId id na biblioteca de mídia
	 * @param aspect proporção pedida — `"1:1"` é o quadrado do feed; `"9:16"` é
	 * o quadro do story, com a foto inteira sobre o fundo desfocado
	 */
	resolve(
		mediaId: string,
		aspect: CropAspect | "original",
	): Promise<PublishableImage | null>;

	/**
	 * A arte de um padrão, desenhada com a foto do post (spec 09, F5).
	 *
	 * Mesmo contrato de `resolve`: `null` quando a foto não existe mais — erro
	 * definitivo para a entrega —, e falha de rede LANÇA, para a entrega ficar
	 * pendente e a próxima rodada tentar de novo.
	 */
	artwork(request: ArtworkRequest): Promise<PublishableImage | null>;
}
