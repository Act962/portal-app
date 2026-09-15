import {
	ACCEPTS_MANUAL,
	type DeliveryMode,
	deliveryModeFor,
	type SocialDestination,
} from "./platform";

/**
 * O estado da ENTREGA em uma rede. Não confundir com o estado do post: um post
 * tem uma legenda e duas entregas, e elas falham separado.
 *
 * `AGUARDANDO_PESSOA` e `DISPENSADA` são do modo manual (spec 11, D3): a arte
 * está pronta e espera alguém publicar pelo app — ou alguém decidiu não publicar.
 */
export type DeliveryStatus =
	| "PENDENTE"
	| "AGUARDANDO_PESSOA"
	| "PUBLICADO"
	| "FALHOU"
	| "DISPENSADA";

type DeliveryProps = {
	/** Para onde vai: o feed de uma rede ou os Stories (§17). A conta que
	 * publica sai daqui, por `DESTINATION_PLATFORM`. */
	destination: SocialDestination;
	status: DeliveryStatus;
	/** Quem põe no ar: o worker ou uma pessoa (spec 11, D1). */
	mode: DeliveryMode;
	/** O id do post NA REDE (`ig_media_id`, `page_post_id`). É a prova de que
	 * saiu — e a razão de nunca reenviarmos esta entrega. Nulo na publicação
	 * manual, que não passa pela API. */
	remoteId: string | null;
	/** Link público do post, quando a rede devolve um — ou quando a pessoa cola. */
	permalink: string | null;
	/** Por que falhou, em português, para a tela mostrar sem tradução. */
	error: string | null;
	/** Quantas vezes já tentamos. Existe para a tela parar de oferecer "tentar
	 * de novo" indefinidamente sobre um erro que não é transitório. */
	attempts: number;
	lastAttemptAt: Date | null;
	/** A arte pronta para a pessoa publicar (spec 11, D5). Só no manual. */
	preparedImageUrl: string | null;
	/** Quem confirmou a publicação manual — a prova dela (spec 11, D7). */
	publishedByStaffId: string | null;
};

/** O que `restore` aceita: os campos do modo manual chegaram depois. */
type RestoreProps = Omit<
	DeliveryProps,
	"mode" | "preparedImageUrl" | "publishedByStaffId"
> &
	Partial<
		Pick<DeliveryProps, "mode" | "preparedImageUrl" | "publishedByStaffId">
	>;

/**
 * Uma tentativa de colocar o mesmo post em UMA rede.
 *
 * Por que a entrega é uma entidade dentro do post, e não um post por rede:
 *
 * A redação escreve **uma** legenda e aprova **uma** vez — é assim que a pessoa
 * pensa o trabalho, e dois registros independentes obrigariam a aprovar duas
 * vezes a mesma decisão. Mas o Instagram pode recusar a imagem enquanto o
 * Facebook aceita, e nesse dia é preciso reenviar SÓ o Instagram. Guardar
 * `remoteId` por entrega é o que torna isso possível sem duplicar o post do
 * Facebook — que é o erro clássico de quem modela isso como um estado só.
 */
export class Delivery {
	private constructor(private readonly state: DeliveryProps) {}

	static pending(
		destination: SocialDestination,
		mode?: DeliveryMode,
	): Delivery {
		return new Delivery({
			destination,
			status: "PENDENTE",
			mode: deliveryModeFor(destination, mode),
			remoteId: null,
			permalink: null,
			error: null,
			attempts: 0,
			lastAttemptAt: null,
			preparedImageUrl: null,
			publishedByStaffId: null,
		});
	}

	static restore(props: RestoreProps): Delivery {
		return new Delivery({
			...props,
			// Linha gravada antes do modo manual existir saiu pela API.
			mode: props.mode ?? "AUTOMATICO",
			preparedImageUrl: props.preparedImageUrl ?? null,
			publishedByStaffId: props.publishedByStaffId ?? null,
		});
	}

	get destination(): SocialDestination {
		return this.state.destination;
	}
	get status(): DeliveryStatus {
		return this.state.status;
	}
	get mode(): DeliveryMode {
		return this.state.mode;
	}
	get remoteId(): string | null {
		return this.state.remoteId;
	}
	get permalink(): string | null {
		return this.state.permalink;
	}
	get error(): string | null {
		return this.state.error;
	}
	get attempts(): number {
		return this.state.attempts;
	}
	get lastAttemptAt(): Date | null {
		return this.state.lastAttemptAt;
	}
	get preparedImageUrl(): string | null {
		return this.state.preparedImageUrl;
	}
	get publishedByStaffId(): string | null {
		return this.state.publishedByStaffId;
	}

	isManual(): boolean {
		return this.state.mode === "MANUAL";
	}
	isPending(): boolean {
		return this.state.status === "PENDENTE";
	}
	isAwaitingPerson(): boolean {
		return this.state.status === "AGUARDANDO_PESSOA";
	}
	isPublished(): boolean {
		return this.state.status === "PUBLICADO";
	}
	isFailed(): boolean {
		return this.state.status === "FALHOU";
	}
	isDismissed(): boolean {
		return this.state.status === "DISPENSADA";
	}

	/**
	 * Registra que saiu. **Ignora a segunda chamada**, e essa é a invariante mais
	 * importante deste arquivo: entrega já publicada nunca muda de `remoteId`.
	 *
	 * O caminho que torna isso real: a chamada à Meta teve sucesso, a resposta se
	 * perdeu no caminho de volta, e o reenvio criou um SEGUNDO post lá. Se
	 * aceitássemos a sobrescrita, perderíamos o id do primeiro — e com ele a
	 * única chance de apagar a duplicata.
	 */
	markPublished(remoteId: string, permalink: string | null, at: Date): void {
		if (this.state.status === "PUBLICADO") {
			return;
		}
		this.state.status = "PUBLICADO";
		this.state.remoteId = remoteId;
		this.state.permalink = permalink;
		this.state.error = null;
		this.state.attempts += 1;
		this.state.lastAttemptAt = at;
	}

	/** Pela mesma razão acima: o que já está no ar não passa a "falhou" porque
	 * uma chamada posterior deu erro. */
	markFailed(reason: string, at: Date): void {
		if (this.state.status === "PUBLICADO") {
			return;
		}
		this.state.status = "FALHOU";
		this.state.error = reason;
		this.state.attempts += 1;
		this.state.lastAttemptAt = at;
	}

	/**
	 * Registra uma falha PASSAGEIRA sem tirar a entrega da fila.
	 *
	 * A entrega continua `PENDENTE` — a próxima rodada do worker a pega de novo —
	 * mas o erro fica visível, para a tela dizer por que ainda não saiu em vez de
	 * mostrar um "enviando" mudo por quinze minutos.
	 */
	markRetrying(reason: string, at: Date): void {
		if (this.state.status === "PUBLICADO") {
			return;
		}
		this.state.status = "PENDENTE";
		this.state.error = reason;
		this.state.attempts += 1;
		this.state.lastAttemptAt = at;
	}

	/**
	 * A arte da entrega manual está pronta: agora é com uma pessoa (spec 11, D5).
	 * Só a entrega manual PENDENTE passa por aqui — a automática nunca espera
	 * ninguém, e a que já foi preparada não prepara de novo.
	 */
	markPrepared(imageUrl: string, at: Date): void {
		if (this.state.mode !== "MANUAL" || this.state.status !== "PENDENTE") {
			return;
		}
		this.state.status = "AGUARDANDO_PESSOA";
		this.state.preparedImageUrl = imageUrl;
		this.state.error = null;
		this.state.attempts += 1;
		this.state.lastAttemptAt = at;
	}

	/**
	 * Uma pessoa publicou pelo app e confirmou (spec 11, D7). A prova é quem
	 * clicou; `remoteId` fica nulo porque a API não participou. Devolve `false`
	 * quando a entrega não estava esperando ninguém — publicada duas vezes, ou
	 * ainda sem arte.
	 */
	markPublishedByPerson(
		staffId: string,
		permalink: string | null,
		at: Date,
	): boolean {
		if (this.state.status !== "AGUARDANDO_PESSOA") {
			return false;
		}
		this.state.status = "PUBLICADO";
		this.state.publishedByStaffId = staffId;
		this.state.permalink = permalink;
		this.state.error = null;
		this.state.lastAttemptAt = at;
		return true;
	}

	/**
	 * Alguém decidiu não publicar (spec 11, D3). Vale para o que espera uma
	 * pessoa e para o que falhou; o que está no ar ou a caminho não se dispensa.
	 */
	dismiss(): boolean {
		if (
			this.state.status !== "AGUARDANDO_PESSOA" &&
			this.state.status !== "FALHOU"
		) {
			return false;
		}
		this.state.status = "DISPENSADA";
		return true;
	}

	/**
	 * A entrega automática falhou, e uma pessoa vai publicar à mão (spec 11, D8).
	 * Volta para a fila, agora para ser PREPARADA, com um ciclo novo de
	 * tentativas — como o `requeue`.
	 */
	switchToManual(): boolean {
		if (
			this.state.status !== "FALHOU" ||
			this.state.mode !== "AUTOMATICO" ||
			!ACCEPTS_MANUAL[this.state.destination]
		) {
			return false;
		}
		this.state.mode = "MANUAL";
		this.state.status = "PENDENTE";
		this.state.error = null;
		this.state.attempts = 0;
		return true;
	}

	/**
	 * Devolve a entrega para a fila. Só o que falhou volta — é o que faz o
	 * "tentar de novo" do painel nunca reenviar o que deu certo.
	 *
	 * Zera `attempts`: cada "tentar de novo" abre um ciclo novo de tentativas
	 * automáticas. Sem isso, uma entrega que já esgotou as três desistiria na
	 * primeira instabilidade depois do clique — e o botão pareceria quebrado.
	 */
	requeue(): void {
		if (this.state.status !== "FALHOU") {
			return;
		}
		this.state.status = "PENDENTE";
		this.state.error = null;
		this.state.attempts = 0;
	}
}
