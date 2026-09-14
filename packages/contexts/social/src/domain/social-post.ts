import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { Caption } from "./caption";
import { Delivery } from "./delivery";
import {
	type CaptionRequired,
	InvalidMediaSelection,
	InvalidPostTransition,
	PostNotReady,
} from "./errors";
import {
	SocialPostApproved,
	SocialPostDrafted,
	SocialPostFailed,
	SocialPostPublished,
} from "./events";
import {
	PLATFORM_LABEL,
	PLATFORM_LIMITS,
	type SocialPlatform,
} from "./platform";

/**
 * De onde veio o post. Guardado, e não inferido de `articleId`, porque a
 * diferença importa para a tela: um post AUTOMÁTICO chegou sozinho na fila e
 * ninguém ainda o leu; um MANUAL alguém digitou.
 */
export type PostOrigin = "AUTOMATICA" | "MANUAL";

/**
 * O estado do post inteiro.
 *
 * `PARCIAL` é o estado que quase toda implementação esquece e é o que mais
 * acontece na prática: o Facebook aceitou, o Instagram recusou a imagem. Sem
 * ele, ou o post mente que deu certo (e ninguém repara que o Instagram ficou
 * sem), ou mente que falhou (e alguém reenvia, duplicando no Facebook).
 */
export type PostStatus =
	| "RASCUNHO"
	| "PUBLICANDO"
	| "PUBLICADO"
	| "PARCIAL"
	| "FALHOU"
	| "CANCELADA";

/** Teto absoluto de imagens — o menor entre as redes suportadas. */
export const MAX_MEDIA_ITEMS = 10;

type PostProps = {
	id: string;
	/** A matéria que originou o post. Nulo num post avulso. */
	articleId: string | null;
	origin: PostOrigin;
	caption: Caption;
	/** Ids da biblioteca de mídia, NA ORDEM em que aparecem no carrossel. */
	mediaIds: readonly string[];
	/** O link da matéria. Vai para o Facebook; no Instagram não é clicável, e o
	 * modelo de legenda padrão não o inclui (ver `PlatformLimits`). */
	linkUrl: string | null;
	deliveries: Delivery[];
	status: PostStatus;
	createdAt: Date;
	approvedAt: Date | null;
	approvedByStaffId: string | null;
};

/**
 * Um post a caminho das redes — uma legenda, um conjunto de imagens e uma
 * entrega por rede escolhida.
 *
 * O fluxo, e por que ele tem esta forma:
 *
 * ```
 * RASCUNHO ──approve()──► PUBLICANDO ──┬─► PUBLICADO  (todas as redes aceitaram)
 *    │                                 ├─► PARCIAL    (uma aceitou, outra não)
 *    │                                 └─► FALHOU     (nenhuma aceitou)
 *    │                                          │
 *  cancel()                            retryFailed() ─► PUBLICANDO
 *    ▼                                       (só as que falharam voltam)
 * CANCELADA
 * ```
 *
 * **`PUBLICANDO` é o cadeado.** Ele existe porque publicar é chamar a Meta, e
 * chamada de rede demora: sem um estado que marque "esta já está a caminho",
 * dois cliques no botão — ou a mesma pessoa em duas abas — mandariam o post
 * duas vezes, e o Instagram não tem desfazer. O agregado recusa o segundo
 * `approve()` com `InvalidPostTransition`, e é isso que torna a fila segura.
 *
 * **Ninguém volta a RASCUNHO.** Depois de aprovado, o texto é congelado: editar
 * a legenda de um post que já está no Facebook criaria duas verdades sobre o
 * que o veículo disse, e a auditoria deixaria de servir para alguma coisa.
 */
export class SocialPost extends AggregateRoot<string> {
	private constructor(private readonly state: PostProps) {
		super(state.id);
	}

	static draft(input: {
		id: string;
		articleId?: string | null;
		origin: PostOrigin;
		captionText: string;
		mediaIds: readonly string[];
		linkUrl?: string | null;
		platforms: readonly SocialPlatform[];
		createdAt: Date;
	}): Result<SocialPost, CaptionRequired | InvalidMediaSelection> {
		const caption = Caption.create(input.captionText);
		if (caption.isErr()) {
			return err(caption.error);
		}
		const media = normalizeMedia(input.mediaIds);
		if (media.isErr()) {
			return err(media.error);
		}

		const post = new SocialPost({
			id: input.id,
			articleId: input.articleId ?? null,
			origin: input.origin,
			caption: caption.value,
			mediaIds: media.value,
			linkUrl: input.linkUrl ?? null,
			deliveries: uniquePlatforms(input.platforms).map((platform) =>
				Delivery.pending(platform),
			),
			// Nasce RASCUNHO mesmo vindo de matéria já publicada: a decisão do
			// cliente (D1) é que ninguém seja surpreendido por um post que não leu.
			// Aprovar é ato explícito.
			status: "RASCUNHO",
			createdAt: input.createdAt,
			approvedAt: null,
			approvedByStaffId: null,
		});
		post.record(
			new SocialPostDrafted(
				post.id,
				post.state.articleId,
				post.targets,
				input.createdAt,
			),
		);
		return ok(post);
	}

	static restore(props: PostProps): SocialPost {
		return new SocialPost({
			...props,
			mediaIds: [...props.mediaIds],
			deliveries: [...props.deliveries],
		});
	}

	get articleId(): string | null {
		return this.state.articleId;
	}
	get origin(): PostOrigin {
		return this.state.origin;
	}
	get caption(): Caption {
		return this.state.caption;
	}
	get mediaIds(): readonly string[] {
		return this.state.mediaIds;
	}
	get linkUrl(): string | null {
		return this.state.linkUrl;
	}
	get deliveries(): readonly Delivery[] {
		return this.state.deliveries;
	}
	get status(): PostStatus {
		return this.state.status;
	}
	get createdAt(): Date {
		return this.state.createdAt;
	}
	get approvedAt(): Date | null {
		return this.state.approvedAt;
	}
	get approvedByStaffId(): string | null {
		return this.state.approvedByStaffId;
	}

	/** As redes escolhidas. */
	get targets(): readonly SocialPlatform[] {
		return this.state.deliveries.map((delivery) => delivery.platform);
	}

	/**
	 * A legenda como ela sai NESTA rede.
	 *
	 * A diferença entre as duas é UMA linha — o link — e é aqui que ela mora, e
	 * não numa segunda legenda guardada no agregado. O motivo é o D8: o que foi
	 * aprovado é um texto só. Duas legendas significariam aprovar duas vezes, e
	 * no dia em que alguém corrigisse só uma, o veículo estaria dizendo coisas
	 * diferentes em cada rede sem ninguém perceber.
	 *
	 * No Instagram a URL não é clicável, então ela não entra. No Facebook entra —
	 * e não é acrescentada se a pessoa já a escreveu na legenda à mão, o que é o
	 * caso mais comum de duplicata boba.
	 */
	captionFor(platform: SocialPlatform): string {
		const text = this.state.caption.value;
		if (!PLATFORM_LIMITS[platform].captionLinksAreClickable) {
			return text;
		}
		if (this.state.linkUrl === null || text.includes(this.state.linkUrl)) {
			return text;
		}
		return `${text}\n\n${this.state.linkUrl}`;
	}

	/** Uma imagem é foto; duas ou mais, carrossel. */
	get isCarousel(): boolean {
		return this.state.mediaIds.length > 1;
	}

	deliveryFor(platform: SocialPlatform): Delivery | undefined {
		return this.state.deliveries.find(
			(delivery) => delivery.platform === platform,
		);
	}

	/** O que ainda falta enviar — é sobre esta lista que o adapter itera. */
	pendingDeliveries(): readonly Delivery[] {
		return this.state.deliveries.filter((delivery) => delivery.isPending());
	}

	/**
	 * O que impede este post de ir ao ar, em frases prontas para a tela.
	 *
	 * Devolve MOTIVOS, não um booleano, e os devolve ANTES do clique: os limites
	 * da Meta são conhecidos (2200 caracteres, 30 hashtags, 10 imagens), e
	 * descobri-los pelo erro 400 da chamada significaria a redação escrever a
	 * legenda inteira para perdê-la no envio.
	 */
	publicationBlockers(): readonly string[] {
		const blockers: string[] = [];

		if (this.state.deliveries.length === 0) {
			blockers.push("Escolha ao menos uma rede social.");
		}
		if (this.state.mediaIds.length === 0) {
			blockers.push("A publicação precisa de ao menos uma imagem.");
		}

		for (const platform of this.targets) {
			const limits = PLATFORM_LIMITS[platform];
			const label = PLATFORM_LABEL[platform];

			if (this.state.caption.exceedsLengthFor(platform)) {
				blockers.push(
					`A legenda tem ${this.state.caption.length} caracteres e o ${label} aceita ${limits.captionMaxLength}.`,
				);
			}
			if (this.state.caption.exceedsHashtagsFor(platform)) {
				blockers.push(
					`São ${this.state.caption.hashtags.length} hashtags e o ${label} aceita ${limits.hashtagMaxCount}.`,
				);
			}
			if (this.state.mediaIds.length > limits.mediaMaxCount) {
				blockers.push(
					`São ${this.state.mediaIds.length} imagens e o ${label} aceita ${limits.mediaMaxCount}.`,
				);
			}
			if (
				this.isCarousel &&
				this.state.mediaIds.length < limits.carouselMinCount
			) {
				/* v8 ignore next 4 -- inalcançável hoje: `isCarousel` já exige 2
				   imagens e as duas redes pedem 2. A guarda fica porque o mínimo é
				   dado da rede, e a terceira rede pode pedir 3. */
				blockers.push(
					`Um carrossel no ${label} precisa de ao menos ${limits.carouselMinCount} imagens.`,
				);
			}
		}

		return blockers;
	}

	/** Só o rascunho é editável — depois de aprovado, o texto está congelado. */
	edit(input: {
		captionText?: string;
		mediaIds?: readonly string[];
		linkUrl?: string | null;
		platforms?: readonly SocialPlatform[];
	}): Result<
		void,
		CaptionRequired | InvalidMediaSelection | InvalidPostTransition
	> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidPostTransition("editar", this.state.status));
		}
		if (input.captionText !== undefined) {
			const caption = Caption.create(input.captionText);
			if (caption.isErr()) {
				return err(caption.error);
			}
			this.state.caption = caption.value;
		}
		if (input.mediaIds !== undefined) {
			const media = normalizeMedia(input.mediaIds);
			if (media.isErr()) {
				return err(media.error);
			}
			this.state.mediaIds = media.value;
		}
		if (input.linkUrl !== undefined) {
			this.state.linkUrl = input.linkUrl;
		}
		if (input.platforms !== undefined) {
			// As entregas são recriadas do zero: nada foi ao ar (o post está em
			// RASCUNHO, garantido acima), então não há histórico a preservar.
			this.state.deliveries = uniquePlatforms(input.platforms).map((platform) =>
				Delivery.pending(platform),
			);
		}
		return ok(undefined);
	}

	/**
	 * Tranca o post e o entrega à fila de envio.
	 *
	 * Devolve erro — e não `void` — na segunda chamada de propósito: quem chama é
	 * um router tRPC atrás de um botão, e o segundo clique precisa virar mensagem
	 * na tela, não um segundo post no Instagram.
	 */
	approve(
		staffId: string,
		at: Date,
	): Result<void, PostNotReady | InvalidPostTransition> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidPostTransition("aprovar", this.state.status));
		}
		const blockers = this.publicationBlockers();
		if (blockers.length > 0) {
			return err(new PostNotReady(blockers));
		}
		this.state.status = "PUBLICANDO";
		this.state.approvedAt = at;
		this.state.approvedByStaffId = staffId;
		this.record(new SocialPostApproved(this.id, staffId, this.targets, at));
		return ok(undefined);
	}

	/** A rede aceitou. O `remoteId` é a prova, e nunca mais será sobrescrito. */
	recordSuccess(
		platform: SocialPlatform,
		remoteId: string,
		permalink: string | null,
		at: Date,
	): void {
		const delivery = this.deliveryFor(platform);
		if (!delivery || delivery.isPublished()) {
			return;
		}
		delivery.markPublished(remoteId, permalink, at);
		this.record(
			new SocialPostPublished(this.id, platform, remoteId, permalink, at),
		);
		this.refreshStatus();
	}

	/**
	 * Registra que a rede recusou.
	 *
	 * **`retryable` decide se a entrega sai da fila.** Uma falha passageira (a
	 * Meta instável, limite de chamadas, rede) deixa a entrega `PENDENTE`, com o
	 * motivo visível, para a próxima rodada do worker — até
	 * `MAX_AUTOMATIC_ATTEMPTS`. Aí desiste e vira `FALHOU`, porque insistir para
	 * sempre esconderia um problema que já não é passageiro atrás de um
	 * "enviando" eterno.
	 *
	 * A promessa de nova tentativa é escrita AQUI, e não por quem traduz o erro
	 * da Meta: só o agregado sabe quantas tentativas já foram, e uma frase "será
	 * tentada de novo" na última seria mentira.
	 *
	 * O evento `SocialPostFailed` sai só na falha definitiva — a auditoria
	 * registra o que deixou de ir ao ar, não cada soluço da rede.
	 */
	recordFailure(
		platform: SocialPlatform,
		reason: string,
		at: Date,
		options: { retryable?: boolean } = {},
	): void {
		const delivery = this.deliveryFor(platform);
		if (!delivery || delivery.isPublished()) {
			return;
		}
		if (options.retryable && delivery.attempts + 1 < MAX_AUTOMATIC_ATTEMPTS) {
			delivery.markRetrying(
				`${reason} Nova tentativa automática em alguns minutos.`,
				at,
			);
			this.refreshStatus();
			return;
		}
		const finalReason = options.retryable
			? `${reason} Foram ${MAX_AUTOMATIC_ATTEMPTS} tentativas automáticas sem sucesso — use "Tentar de novo" quando o problema passar.`
			: reason;
		delivery.markFailed(finalReason, at);
		this.record(new SocialPostFailed(this.id, platform, finalReason, at));
		this.refreshStatus();
	}

	/**
	 * Recoloca na fila **apenas o que falhou**.
	 *
	 * É a operação que justifica a entrega ser uma entidade própria: reenviar um
	 * post `PARCIAL` inteiro publicaria no Facebook uma segunda vez. Aqui, a
	 * entrega já publicada nem chega a ser olhada.
	 */
	retryFailed(): Result<void, InvalidPostTransition> {
		if (this.state.status !== "FALHOU" && this.state.status !== "PARCIAL") {
			return err(
				new InvalidPostTransition("tentar de novo", this.state.status),
			);
		}
		for (const delivery of this.state.deliveries) {
			delivery.requeue();
		}
		this.state.status = "PUBLICANDO";
		return ok(undefined);
	}

	/**
	 * Descarta o post.
	 *
	 * Só vale em RASCUNHO. Não existe "cancelar" depois que algo foi ao ar: a
	 * Meta não desfaz publicação por nós, e um botão que prometesse isso estaria
	 * mentindo. Apagar da rede é outra operação, com outro nome, e ainda não
	 * existe.
	 */
	cancel(): Result<void, InvalidPostTransition> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidPostTransition("cancelar", this.state.status));
		}
		this.state.status = "CANCELADA";
		return ok(undefined);
	}

	/**
	 * O status do post é DERIVADO das entregas — nunca atribuído de fora.
	 *
	 * É o mesmo princípio que levou a publicidade a derivar `ENCERRADA` do
	 * período: uma verdade, um lugar só. Enquanto sobrar entrega pendente, o post
	 * continua `PUBLICANDO`.
	 */
	private refreshStatus(): void {
		if (this.state.deliveries.some((delivery) => delivery.isPending())) {
			this.state.status = "PUBLICANDO";
			return;
		}
		const published = this.state.deliveries.filter((delivery) =>
			delivery.isPublished(),
		).length;
		if (published === this.state.deliveries.length) {
			this.state.status = "PUBLICADO";
		} else if (published > 0) {
			this.state.status = "PARCIAL";
		} else {
			this.state.status = "FALHOU";
		}
	}
}

/**
 * Quantas vezes o worker tenta sozinho uma entrega que falhou por motivo
 * passageiro, antes de desistir e pedir uma pessoa.
 *
 * Três, a cada rodada de cinco minutos: cobre a instabilidade típica da Meta
 * (minutos) sem deixar uma notícia presa em "enviando" por uma hora. Cada
 * "Tentar de novo" do painel abre um ciclo novo de três.
 */
export const MAX_AUTOMATIC_ATTEMPTS = 3;

/**
 * Limpa e valida a lista de imagens.
 *
 * A ordem é preservada porque no carrossel ela É conteúdo: a primeira imagem é
 * a capa que aparece no feed. Duplicata é RECUSADA em vez de silenciosamente
 * removida — a mesma foto duas vezes é erro de clique, e remover por conta
 * própria faria a tela mostrar uma lista diferente da que a pessoa montou.
 */
function normalizeMedia(
	mediaIds: readonly string[],
): Result<readonly string[], InvalidMediaSelection> {
	const cleaned = mediaIds.map((id) => id.trim()).filter((id) => id !== "");
	if (cleaned.length > MAX_MEDIA_ITEMS) {
		return err(
			new InvalidMediaSelection(
				`o limite é de ${MAX_MEDIA_ITEMS} imagens por publicação`,
			),
		);
	}
	if (new Set(cleaned).size !== cleaned.length) {
		return err(new InvalidMediaSelection("a mesma imagem aparece duas vezes"));
	}
	return ok(cleaned);
}

/** Escolher "Instagram" duas vezes na tela não pode virar dois envios. */
function uniquePlatforms(
	platforms: readonly SocialPlatform[],
): readonly SocialPlatform[] {
	return [...new Set(platforms)];
}
