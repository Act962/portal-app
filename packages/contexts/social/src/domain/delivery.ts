import type { SocialDestination } from "./platform";

/**
 * O estado da ENTREGA em uma rede. Não confundir com o estado do post: um post
 * tem uma legenda e duas entregas, e elas falham separado.
 */
export type DeliveryStatus = "PENDENTE" | "PUBLICADO" | "FALHOU";

type DeliveryProps = {
	/** Para onde vai: o feed de uma rede ou os Stories (§17). A conta que
	 * publica sai daqui, por `DESTINATION_PLATFORM`. */
	destination: SocialDestination;
	status: DeliveryStatus;
	/** O id do post NA REDE (`ig_media_id`, `page_post_id`). É a prova de que
	 * saiu — e a razão de nunca reenviarmos esta entrega. */
	remoteId: string | null;
	/** Link público do post, quando a rede devolve um. */
	permalink: string | null;
	/** Por que falhou, em português, para a tela mostrar sem tradução. */
	error: string | null;
	/** Quantas vezes já tentamos. Existe para a tela parar de oferecer "tentar
	 * de novo" indefinidamente sobre um erro que não é transitório. */
	attempts: number;
	lastAttemptAt: Date | null;
};

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

	static pending(destination: SocialDestination): Delivery {
		return new Delivery({
			destination,
			status: "PENDENTE",
			remoteId: null,
			permalink: null,
			error: null,
			attempts: 0,
			lastAttemptAt: null,
		});
	}

	static restore(props: DeliveryProps): Delivery {
		return new Delivery({ ...props });
	}

	get destination(): SocialDestination {
		return this.state.destination;
	}
	get status(): DeliveryStatus {
		return this.state.status;
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

	isPending(): boolean {
		return this.state.status === "PENDENTE";
	}
	isPublished(): boolean {
		return this.state.status === "PUBLICADO";
	}
	isFailed(): boolean {
		return this.state.status === "FALHOU";
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
