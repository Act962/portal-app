import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { Caption } from "./caption";
import { Delivery } from "./delivery";
import {
	type CaptionRequired,
	InvalidArtChoice,
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
	DESTINATION_FORMAT,
	DESTINATION_LABEL,
	PLATFORM_LIMITS,
	type SocialDestination,
} from "./platform";
import {
	type ArtSelection,
	selectionServes,
	withInputs,
} from "./template/art-selection";
import { type ArtContent, contentWithHeadline } from "./template/variables";

/** A arte escolhida para cada destino que tem arte. */
export type ArtSelections = Partial<Record<SocialDestination, ArtSelection>>;

/**
 * De onde veio o post. Guardado, e não inferido de `articleId`, porque a
 * diferença importa para a tela: um post AUTOMÁTICO chegou sozinho na fila e
 * ninguém ainda o leu; um MANUAL alguém digitou.
 */
export type PostOrigin =
	| "AUTOMATICA"
	| "MANUAL"
	/**
	 * Preparado por uma pessoa no editor da MATÉRIA (spec 09, F6). Conta como
	 * "o post da matéria", igual ao automático: o gatilho não cria um segundo
	 * rascunho para ela. É diferente do MANUAL da fila, que é intenção avulsa
	 * ("republica aquela de ontem") e não trava nada.
	 */
	| "MATERIA";

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
	/**
	 * A arte de cada destino (spec 09, F5). Destino sem arte publica a foto
	 * cortada, como antes dos padrões. Opcional para os posts gravados antes.
	 */
	art?: ArtSelections;
	/**
	 * O que preenche as caixas de texto da arte — título, chapéu, editoria.
	 * Guardado no post, e não lido da matéria na hora de desenhar: a matéria
	 * pode ser corrigida depois, e a arte aprovada não pode mudar sozinha (D9).
	 */
	artContent?: ArtContent | null;
	status: PostStatus;
	createdAt: Date;
	approvedAt: Date | null;
	approvedByStaffId: string | null;
};

/**
 * Um post a caminho das redes — uma legenda, um conjunto de imagens e uma
 * entrega por destino escolhido (o feed de cada rede, os Stories).
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
		/** Os DESTINOS escolhidos. Chama-se `platforms` porque nasceu antes dos
		 * Stories, e o feed de cada rede tem o nome dela. */
		platforms: readonly SocialDestination[];
		/** A arte de cada destino. Destino que o post não tem, ou formato que não
		 * serve, é descartado — quem manda aqui é o gatilho automático, com os
		 * padrões de destino, que já são compatíveis. */
		art?: ArtSelections;
		artContent?: ArtContent | null;
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
			deliveries: uniqueDestinations(input.platforms).map((destination) =>
				Delivery.pending(destination),
			),
			// Nasce RASCUNHO mesmo vindo de matéria já publicada: a decisão do
			// cliente (D1) é que ninguém seja surpreendido por um post que não leu.
			// Aprovar é ato explícito.
			status: "RASCUNHO",
			createdAt: input.createdAt,
			approvedAt: null,
			approvedByStaffId: null,
			art: keepServing(input.art ?? {}, uniqueDestinations(input.platforms)),
			artContent: input.artContent ?? null,
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
			art: { ...(props.art ?? {}) },
			artContent: props.artContent ?? null,
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

	/** Os destinos escolhidos. */
	get targets(): readonly SocialDestination[] {
		return this.state.deliveries.map((delivery) => delivery.destination);
	}

	/**
	 * A legenda como ela sai NESTE destino.
	 *
	 * A diferença entre os destinos é UMA linha — o link — e é aqui que ela
	 * mora, e não numa segunda legenda guardada no agregado. O motivo é o D8: o
	 * que foi aprovado é um texto só. Duas legendas significariam aprovar duas
	 * vezes, e no dia em que alguém corrigisse só uma, o veículo estaria dizendo
	 * coisas diferentes em cada rede sem ninguém perceber.
	 *
	 * No Instagram a URL não é clicável, então ela não entra. No Facebook entra —
	 * e não é acrescentada se a pessoa já a escreveu na legenda à mão, o que é o
	 * caso mais comum de duplicata boba. Nos Stories não há legenda nenhuma.
	 */
	captionFor(destination: SocialDestination): string {
		const limits = PLATFORM_LIMITS[destination];
		if (!limits.publishesCaption) {
			return "";
		}
		const text = this.state.caption.value;
		if (!limits.captionLinksAreClickable) {
			return text;
		}
		if (this.state.linkUrl === null || text.includes(this.state.linkUrl)) {
			return text;
		}
		return `${text}\n\n${this.state.linkUrl}`;
	}

	/**
	 * As imagens que vão para ESTE destino, na ordem.
	 *
	 * No feed, todas (uma é foto, várias são carrossel). No story, só a primeira
	 * — a capa. A regra mora aqui, e não no worker, pelo mesmo motivo do
	 * `captionFor`: a tela precisa dizer ANTES da aprovação o que vai sair.
	 */
	imagesFor(destination: SocialDestination): readonly string[] {
		return PLATFORM_LIMITS[destination].images === "FIRST"
			? this.state.mediaIds.slice(0, 1)
			: this.state.mediaIds;
	}

	/** O que preenche as caixas de texto da arte, ou `null`. */
	get artContent(): ArtContent | null {
		return this.state.artContent ?? null;
	}

	/**
	 * O conteúdo com que a arte é DESENHADA: o guardado no post, ou — num post
	 * avulso, que não veio de matéria — a primeira linha da legenda como título.
	 * Sem isto, o padrão sairia com a caixa do título vazia.
	 */
	artContentForDrawing(): ArtContent {
		if (this.state.artContent) {
			return this.state.artContent;
		}
		const firstLine =
			this.state.caption.value
				.split("\n")
				.map((line) => line.trim())
				.find((line) => line !== "") ?? "";
		return contentWithHeadline(firstLine);
	}

	/** A arte de cada destino que tem arte. */
	get artSelections(): Readonly<ArtSelections> {
		return this.state.art ?? {};
	}

	/**
	 * A arte deste destino, ou `null` — destino sem arte publica a foto cortada.
	 * Com arte, o destino publica UMA imagem (a arte), desenhada com a primeira
	 * foto do post.
	 */
	artFor(destination: SocialDestination): ArtSelection | null {
		return this.state.art?.[destination] ?? null;
	}

	/**
	 * Escolhe a arte de um destino — ou tira, com `null`.
	 *
	 * Só no rascunho, pelo mesmo motivo do texto (D8): a arte aprovada é a que
	 * vai ao ar. E só se o formato serve ao destino: um padrão 4:5 nos Stories
	 * sairia com faixas ou cortado pela Meta.
	 */
	chooseArt(
		destination: SocialDestination,
		selection: ArtSelection | null,
	): Result<void, InvalidPostTransition | InvalidArtChoice> {
		if (this.state.status !== "RASCUNHO") {
			return err(
				new InvalidPostTransition("escolher a arte", this.state.status),
			);
		}
		if (selection === null) {
			this.state.art = Object.fromEntries(
				Object.entries(this.state.art ?? {}).filter(
					([key]) => key !== destination,
				),
			) as ArtSelections;
			return ok(undefined);
		}
		const label = DESTINATION_LABEL[destination];
		if (!this.targets.includes(destination)) {
			return err(
				new InvalidArtChoice(`${label} não está entre os destinos deste post.`),
			);
		}
		if (!selectionServes(selection, destination)) {
			const expected =
				DESTINATION_FORMAT[destination] === "STORY" ? "9:16" : "1:1 ou 4:5";
			return err(
				new InvalidArtChoice(
					`O padrão "${selection.templateName}" é ${selection.format}, e ${label} pede ${expected}.`,
				),
			);
		}
		this.state.art = {
			...(this.state.art ?? {}),
			[destination]: withInputs(selection, selection),
		};
		return ok(undefined);
	}

	/** Troca o que preenche as caixas da arte. Só no rascunho (D8). */
	setArtContent(content: ArtContent): Result<void, InvalidPostTransition> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidPostTransition("editar a arte", this.state.status));
		}
		this.state.artContent = { ...content };
		return ok(undefined);
	}

	/** Uma imagem é foto; duas ou mais, carrossel. */
	get isCarousel(): boolean {
		return this.state.mediaIds.length > 1;
	}

	deliveryFor(destination: SocialDestination): Delivery | undefined {
		return this.state.deliveries.find(
			(delivery) => delivery.destination === destination,
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

		for (const destination of this.targets) {
			const limits = PLATFORM_LIMITS[destination];
			const label = DESTINATION_LABEL[destination];

			// Destino sem legenda (Stories) não tem o que medir no texto.
			if (limits.publishesCaption) {
				if (this.state.caption.exceedsLengthFor(destination)) {
					blockers.push(
						`A legenda tem ${this.state.caption.length} caracteres e o ${label} aceita ${limits.captionMaxLength}.`,
					);
				}
				if (this.state.caption.exceedsHashtagsFor(destination)) {
					blockers.push(
						`São ${this.state.caption.hashtags.length} hashtags e o ${label} aceita ${limits.hashtagMaxCount}.`,
					);
				}
			}
			// Destino que usa só a primeira imagem não é barrado pelo carrossel.
			if (limits.images === "FIRST") {
				continue;
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
		platforms?: readonly SocialDestination[];
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
			this.state.deliveries = uniqueDestinations(input.platforms).map(
				(destination) => Delivery.pending(destination),
			);
			// Destino que saiu leva a arte junto — senão ela voltaria sozinha no
			// dia em que o destino fosse marcado de novo, sem ninguém ter escolhido.
			this.state.art = keepServing(this.state.art ?? {}, this.targets);
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

	/** O destino aceitou. O `remoteId` é a prova, e nunca mais será sobrescrito. */
	recordSuccess(
		destination: SocialDestination,
		remoteId: string,
		permalink: string | null,
		at: Date,
	): void {
		const delivery = this.deliveryFor(destination);
		if (!delivery || delivery.isPublished()) {
			return;
		}
		delivery.markPublished(remoteId, permalink, at);
		this.record(
			new SocialPostPublished(this.id, destination, remoteId, permalink, at),
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
		destination: SocialDestination,
		reason: string,
		at: Date,
		options: { retryable?: boolean } = {},
	): void {
		const delivery = this.deliveryFor(destination);
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
		this.record(new SocialPostFailed(this.id, destination, finalReason, at));
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

/**
 * Só a arte dos destinos que o post tem e cujo formato serve — o resto é
 * descartado em silêncio. Silêncio aqui, e não erro, porque quem chega por este
 * caminho é o rascunho (padrões de destino, já compatíveis) e a troca de
 * destinos; a escolha feita por uma pessoa passa por `chooseArt`, que recusa
 * dizendo por quê.
 */
function keepServing(
	art: ArtSelections,
	destinations: readonly SocialDestination[],
): ArtSelections {
	return Object.fromEntries(
		Object.entries(art).filter(
			([destination, selection]) =>
				selection !== undefined &&
				destinations.includes(destination as SocialDestination) &&
				selectionServes(selection, destination as SocialDestination),
		),
	) as ArtSelections;
}

/** Escolher "Instagram" duas vezes na tela não pode virar dois envios. */
function uniqueDestinations(
	destinations: readonly SocialDestination[],
): readonly SocialDestination[] {
	return [...new Set(destinations)];
}
