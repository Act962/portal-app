import "server-only";
import { pollDeps } from "@portal-app/api/polls";
import { currentPoll } from "@portal-app/polls";
import { cookies } from "next/headers";
import { cache } from "react";

/** Cookie httpOnly que identifica a ORIGEM do voto — nunca a pessoa. */
export const VOTER_COOKIE = "poll_voter";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type PollView = {
	id: string;
	question: string;
	totalVotes: number;
	/** A opção em que este leitor votou; `null` se ainda não votou. */
	votedFor: string | null;
	options: Array<{
		id: string;
		label: string;
		/** Só vem preenchido DEPOIS do voto — ver `loadCurrentPoll`. */
		percentage: number | null;
	}>;
};

/**
 * A enquete no ar, do ponto de vista DESTE leitor.
 *
 * Por decisão do cliente, o resultado só aparece depois do voto — e essa
 * decisão é aplicada AQUI, no servidor, zerando as porcentagens de quem não
 * votou. Mandar os números para o cliente e escondê-los no CSS deixaria o
 * resultado a um "inspecionar elemento" de distância, o que anularia o motivo
 * de escondê-lo (não influenciar o voto).
 *
 * `cache()` deduplica dentro do mesmo render, como o resto do read model.
 */
export const loadCurrentPoll = cache(async (): Promise<PollView | null> => {
	const token = (await cookies()).get(VOTER_COOKIE)?.value ?? null;

	const result = await safely(() => currentPoll(token, pollDeps));
	if (!result) {
		return null;
	}

	const votesByOption = new Map(
		result.tally.map((item) => [item.optionId, item.votes]),
	);
	const hasVoted = result.votedFor !== null;

	return {
		id: result.poll.id,
		question: result.poll.question,
		totalVotes: result.totalVotes,
		votedFor: result.votedFor,
		options: result.poll.options.map((option) => ({
			id: option.id,
			label: option.label,
			percentage: hasVoted
				? percentage(votesByOption.get(option.id) ?? 0, result.totalVotes)
				: null,
		})),
	};
});

function percentage(votes: number, total: number): number {
	return total === 0 ? 0 : Math.round((votes / total) * 100);
}

/**
 * Mesma tolerância do resto do read model: o build do CI prerenderiza SEM
 * banco, e em produção o portal deve degradar (aqui: sem enquete) em vez de
 * estourar a página inteira (N03).
 */
async function safely<T>(run: () => Promise<T>): Promise<T | null> {
	try {
		return await run();
	} catch (error) {
		console.warn("[polls] leitura falhou; portal segue sem enquete:", error);
		return null;
	}
}

export { ONE_YEAR_SECONDS };
