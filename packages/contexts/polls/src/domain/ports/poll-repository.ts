import { AlreadyVoted } from "../errors";
import type { Poll } from "../poll";

/** Contagem de votos de uma enquete, por opção. */
export type VoteTally = { optionId: string; votes: number };

/**
 * Porta de persistência do agregado `Poll`.
 *
 * `recordVote` devolve `AlreadyVoted` em vez de lançar porque "este leitor já
 * votou" é resultado esperado, não falha: a garantia real é a chave única
 * (`pollId + voterToken`) no banco, e é ela que resiste a dois cliques
 * simultâneos. Checar antes com um `findVote` seria uma corrida.
 */
export interface PollRepository {
	findById(id: string): Promise<Poll | null>;
	/** A enquete publicada — o portal mostra uma de cada vez. */
	findPublished(): Promise<Poll | null>;
	list(): Promise<Poll[]>;
	save(poll: Poll): Promise<void>;
	delete(id: string): Promise<void>;
	tally(pollId: string): Promise<VoteTally[]>;
	recordVote(input: {
		id: string;
		pollId: string;
		optionId: string;
		voterToken: string;
		now: Date;
	}): Promise<AlreadyVoted | null>;
	/** Em qual opção este leitor votou, se votou. */
	findVote(pollId: string, voterToken: string): Promise<string | null>;
}

/** Fake in-memory da porta, para os testes de aplicação. */
export class InMemoryPollRepository implements PollRepository {
	private readonly polls = new Map<string, Poll>();
	private readonly votes: Array<{
		pollId: string;
		optionId: string;
		voterToken: string;
	}> = [];

	findById(id: string): Promise<Poll | null> {
		return Promise.resolve(this.polls.get(id) ?? null);
	}

	findPublished(): Promise<Poll | null> {
		const published = [...this.polls.values()]
			.filter((poll) => poll.isOpen())
			.sort(
				(a, b) =>
					(b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
			);
		return Promise.resolve(published[0] ?? null);
	}

	list(): Promise<Poll[]> {
		return Promise.resolve([...this.polls.values()]);
	}

	save(poll: Poll): Promise<void> {
		this.polls.set(poll.id, poll);
		return Promise.resolve();
	}

	delete(id: string): Promise<void> {
		this.polls.delete(id);
		// Os votos saem junto — é o que o `onDelete: Cascade` do schema faz no
		// Postgres. Sem isto o fake mentiria sobre o comportamento real (foi o
		// teste de contrato que pegou a divergência).
		for (let i = this.votes.length - 1; i >= 0; i--) {
			if (this.votes[i]?.pollId === id) {
				this.votes.splice(i, 1);
			}
		}
		return Promise.resolve();
	}

	tally(pollId: string): Promise<VoteTally[]> {
		const counts = new Map<string, number>();
		for (const vote of this.votes) {
			if (vote.pollId === pollId) {
				counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
			}
		}
		return Promise.resolve(
			[...counts.entries()].map(([optionId, votes]) => ({ optionId, votes })),
		);
	}

	recordVote(input: {
		pollId: string;
		optionId: string;
		voterToken: string;
	}): Promise<AlreadyVoted | null> {
		const duplicate = this.votes.some(
			(vote) =>
				vote.pollId === input.pollId && vote.voterToken === input.voterToken,
		);
		if (duplicate) {
			return Promise.resolve(new AlreadyVoted());
		}
		this.votes.push({
			pollId: input.pollId,
			optionId: input.optionId,
			voterToken: input.voterToken,
		});
		return Promise.resolve(null);
	}

	findVote(pollId: string, voterToken: string): Promise<string | null> {
		const vote = this.votes.find(
			(item) => item.pollId === pollId && item.voterToken === voterToken,
		);
		return Promise.resolve(vote?.optionId ?? null);
	}

	clear(): void {
		this.polls.clear();
		this.votes.length = 0;
	}
}
