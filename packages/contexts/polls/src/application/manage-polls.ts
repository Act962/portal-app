import {
	type Clock,
	type IdGenerator,
	type Result,
	err,
	ok,
} from "@portal-app/shared-kernel";

import type {
	AlreadyVoted,
	InvalidPollTransition,
	OptionLabelRequired,
	OptionNotInPoll,
	OptionsLockedAfterPublish,
	PollNotOpen,
	QuestionRequired,
	TooFewOptions,
} from "../domain/errors";
import { PollNotFound } from "../domain/errors";
import type {
	PollRepository,
	VoteTally,
} from "../domain/ports/poll-repository";
import { Poll } from "../domain/poll";

/**
 * Casos de uso das enquetes. A AUTORIZAÇÃO fica na fronteira da API
 * (`requirePermission("polls:manage")` nas mutações do admin; votar é
 * público) — mesmo arranjo dos demais contextos.
 */
type Deps = {
	repo: PollRepository;
	ids: IdGenerator;
	clock: Clock;
};

type SaveError = QuestionRequired | TooFewOptions | OptionLabelRequired;

export function listPolls(deps: Pick<Deps, "repo">): Promise<Poll[]> {
	return deps.repo.list();
}

export async function createPoll(
	input: { question: string; options: string[] },
	deps: Deps,
): Promise<Result<Poll, SaveError>> {
	const created = Poll.create({
		id: deps.ids.generate(),
		question: input.question,
		options: input.options.map((label) => ({
			id: deps.ids.generate(),
			label,
		})),
	});
	if (created.isErr()) {
		return err(created.error);
	}
	await deps.repo.save(created.value);
	return created;
}

export async function updatePoll(
	input: { id: string; question?: string; options?: string[] },
	deps: Deps,
): Promise<Result<Poll, SaveError | OptionsLockedAfterPublish | PollNotFound>> {
	const poll = await deps.repo.findById(input.id);
	if (!poll) {
		return err(new PollNotFound(input.id));
	}
	const updated = poll.update({
		question: input.question,
		options: input.options?.map((label) => ({
			id: deps.ids.generate(),
			label,
		})),
	});
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.repo.save(poll);
	return ok(poll);
}

/**
 * Publica a enquete e FECHA a que estava no ar.
 *
 * O portal mostra uma enquete de cada vez ("Enquete da semana"): sem isto, a
 * segunda publicação deixaria a primeira viva e invisível, ainda recebendo
 * voto de quem tivesse a página velha aberta.
 */
export async function publishPoll(
	input: { id: string },
	deps: Deps,
): Promise<Result<Poll, PollNotFound | InvalidPollTransition>> {
	const poll = await deps.repo.findById(input.id);
	if (!poll) {
		return err(new PollNotFound(input.id));
	}

	const current = await deps.repo.findPublished();
	const published = poll.publish(deps.clock.now());
	if (published.isErr()) {
		return err(published.error);
	}

	if (current && current.id !== poll.id) {
		current.close();
		await deps.repo.save(current);
	}
	await deps.repo.save(poll);
	return ok(poll);
}

export async function closePoll(
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<Poll, PollNotFound | InvalidPollTransition>> {
	const poll = await deps.repo.findById(input.id);
	if (!poll) {
		return err(new PollNotFound(input.id));
	}
	const closed = poll.close();
	if (closed.isErr()) {
		return err(closed.error);
	}
	await deps.repo.save(poll);
	return ok(poll);
}

export async function deletePoll(
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<void, PollNotFound>> {
	const poll = await deps.repo.findById(input.id);
	if (!poll) {
		return err(new PollNotFound(input.id));
	}
	await deps.repo.delete(poll.id);
	return ok(undefined);
}

export type PollResult = {
	poll: Poll;
	tally: VoteTally[];
	totalVotes: number;
	/** A opção em que ESTE leitor votou, se votou. */
	votedFor: string | null;
};

/**
 * A enquete no ar, com o resultado — e em qual opção este leitor votou.
 *
 * Quem CHAMA decide se mostra os números: por decisão do cliente, o resultado
 * só aparece depois do voto. A contagem vem junto de propósito, para a tela
 * poder revelar o resultado sem uma segunda ida ao servidor logo após votar.
 */
export async function currentPoll(
	voterToken: string | null,
	deps: Pick<Deps, "repo">,
): Promise<PollResult | null> {
	const poll = await deps.repo.findPublished();
	if (!poll) {
		return null;
	}
	const [tally, votedFor] = await Promise.all([
		deps.repo.tally(poll.id),
		voterToken ? deps.repo.findVote(poll.id, voterToken) : Promise.resolve(null),
	]);
	return {
		poll,
		tally,
		totalVotes: tally.reduce((total, item) => total + item.votes, 0),
		votedFor,
	};
}

/** Resultado de uma enquete específica — usado pelo painel. */
export async function pollResult(
	input: { id: string },
	deps: Pick<Deps, "repo">,
): Promise<Result<PollResult, PollNotFound>> {
	const poll = await deps.repo.findById(input.id);
	if (!poll) {
		return err(new PollNotFound(input.id));
	}
	const tally = await deps.repo.tally(poll.id);
	return ok({
		poll,
		tally,
		totalVotes: tally.reduce((total, item) => total + item.votes, 0),
		votedFor: null,
	});
}

export async function vote(
	input: { pollId: string; optionId: string; voterToken: string },
	deps: Deps,
): Promise<
	Result<PollResult, PollNotFound | PollNotOpen | OptionNotInPoll | AlreadyVoted>
> {
	const poll = await deps.repo.findById(input.pollId);
	if (!poll) {
		return err(new PollNotFound(input.pollId));
	}

	const admissible = poll.ensureCanReceiveVote(input.optionId);
	if (admissible.isErr()) {
		return err(admissible.error);
	}

	// "Já votou" é decidido pelo BANCO (chave única), não por uma leitura
	// prévia: entre o `findVote` e o `insert` cabe um segundo clique.
	const duplicate = await deps.repo.recordVote({
		id: deps.ids.generate(),
		pollId: poll.id,
		optionId: input.optionId,
		voterToken: input.voterToken,
		now: deps.clock.now(),
	});
	if (duplicate) {
		return err(duplicate);
	}

	const tally = await deps.repo.tally(poll.id);
	return ok({
		poll,
		tally,
		totalVotes: tally.reduce((total, item) => total + item.votes, 0),
		votedFor: input.optionId,
	});
}
