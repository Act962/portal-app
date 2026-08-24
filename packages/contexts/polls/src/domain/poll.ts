import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	InvalidPollTransition,
	OptionLabelRequired,
	OptionNotInPoll,
	OptionsLockedAfterPublish,
	PollNotOpen,
	QuestionRequired,
	TooFewOptions,
} from "./errors";

export type PollStatus = "RASCUNHO" | "PUBLICADA" | "FECHADA";

export type PollOption = {
	id: string;
	label: string;
	order: number;
};

type PollState = {
	question: string;
	options: PollOption[];
	status: PollStatus;
	publishedAt: Date | null;
};

type OptionInput = { id: string; label: string };

type CreateError = QuestionRequired | TooFewOptions | OptionLabelRequired;

/**
 * Enquete — o agregado raiz do contexto. As OPÇÕES fazem parte do agregado (não
 * são entidades independentes): elas só existem dentro de uma enquete, e a
 * invariante "pelo menos duas" é sobre o conjunto, não sobre cada uma.
 *
 * Os VOTOS ficam de fora de propósito. Carregá-los junto obrigaria a trazer
 * milhares de linhas para registrar mais um, e a invariante "um voto por
 * leitor" é garantida no banco (chave única `pollId + voterToken`) — que é o
 * único lugar onde ela resiste a duas requisições simultâneas.
 *
 * Máquina de estados: `RASCUNHO → PUBLICADA → FECHADA`, sem volta. Reabrir uma
 * enquete fechada misturaria votos de dois momentos diferentes sob o mesmo
 * resultado.
 */
export class Poll extends AggregateRoot<string> {
	private state: PollState;

	private constructor(id: string, state: PollState) {
		super(id);
		this.state = state;
	}

	static create(input: {
		id: string;
		question: string;
		options: OptionInput[];
	}): Result<Poll, CreateError> {
		const question = input.question.trim();
		if (!question) {
			return err(new QuestionRequired());
		}

		const options = normalizeOptions(input.options);
		if (options.isErr()) {
			return err(options.error);
		}

		return ok(
			new Poll(input.id, {
				question,
				options: options.value,
				status: "RASCUNHO",
				publishedAt: null,
			}),
		);
	}

	/** Reidrata a partir da persistência (ou de um teste). Assume dado válido. */
	static restore(props: {
		id: string;
		question: string;
		options: PollOption[];
		status: PollStatus;
		publishedAt: Date | null;
	}): Poll {
		return new Poll(props.id, {
			question: props.question,
			options: [...props.options].sort((a, b) => a.order - b.order),
			status: props.status,
			publishedAt: props.publishedAt,
		});
	}

	get question(): string {
		return this.state.question;
	}

	get options(): readonly PollOption[] {
		return this.state.options;
	}

	get status(): PollStatus {
		return this.state.status;
	}

	get publishedAt(): Date | null {
		return this.state.publishedAt;
	}

	isOpen(): boolean {
		return this.state.status === "PUBLICADA";
	}

	hasOption(optionId: string): boolean {
		return this.state.options.some((option) => option.id === optionId);
	}

	/**
	 * Edita pergunta e opções. As opções só mudam enquanto a enquete é
	 * RASCUNHO — depois de publicada existem votos apontando para elas.
	 */
	update(input: {
		question?: string;
		options?: OptionInput[];
	}): Result<void, CreateError | OptionsLockedAfterPublish> {
		const next = { ...this.state };

		if (input.question !== undefined) {
			const question = input.question.trim();
			if (!question) {
				return err(new QuestionRequired());
			}
			next.question = question;
		}

		if (input.options !== undefined) {
			if (this.state.status !== "RASCUNHO") {
				return err(new OptionsLockedAfterPublish());
			}
			const options = normalizeOptions(input.options);
			if (options.isErr()) {
				return err(options.error);
			}
			next.options = options.value;
		}

		this.state = next;
		return ok(undefined);
	}

	/** Publica a enquete — só a partir do rascunho. */
	publish(now: Date): Result<void, InvalidPollTransition> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidPollTransition(this.state.status, "PUBLICADA"));
		}
		this.state = { ...this.state, status: "PUBLICADA", publishedAt: now };
		return ok(undefined);
	}

	/** Fecha a votação — só a partir de publicada. O resultado congela. */
	close(): Result<void, InvalidPollTransition> {
		if (this.state.status !== "PUBLICADA") {
			return err(new InvalidPollTransition(this.state.status, "FECHADA"));
		}
		this.state = { ...this.state, status: "FECHADA" };
		return ok(undefined);
	}

	/**
	 * O agregado decide se ESTE voto é admissível: enquete aberta e opção que
	 * pertence a ela. "Já votou" NÃO é decidido aqui — depende do que está
	 * gravado, então é o banco que responde (chave única).
	 */
	ensureCanReceiveVote(
		optionId: string,
	): Result<void, PollNotOpen | OptionNotInPoll> {
		if (!this.isOpen()) {
			return err(new PollNotOpen());
		}
		if (!this.hasOption(optionId)) {
			return err(new OptionNotInPoll());
		}
		return ok(undefined);
	}
}

function normalizeOptions(
	raw: OptionInput[],
): Result<PollOption[], TooFewOptions | OptionLabelRequired> {
	const options = raw.map((option, index) => ({
		id: option.id,
		label: option.label.trim(),
		order: index,
	}));

	if (options.length < 2) {
		return err(new TooFewOptions());
	}
	if (options.some((option) => option.label === "")) {
		return err(new OptionLabelRequired());
	}
	return ok(options);
}
