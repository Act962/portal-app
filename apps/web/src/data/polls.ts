import "server-only";
import { pollDeps } from "@portal-app/api/polls";
import { closedPolls, currentPoll } from "@portal-app/polls";
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

/**
 * O arquivo da página `/enquetes`: as encerradas, da mais recente para a mais
 * antiga, com o resultado aberto.
 *
 * `votedFor` vem sempre `null` — não é omissão. A enquete está fechada, então
 * não há botão para marcar, e destacar "você votou aqui" numa consulta que
 * acabou exigiria ler o cookie para não mostrar nada acionável.
 */
export const loadClosedPolls = cache(async (): Promise<PollView[]> => {
	const results = (await safely(() => closedPolls(pollDeps))) ?? [];

	return results
		.sort(
			(a, b) =>
				(b.poll.publishedAt?.getTime() ?? 0) -
				(a.poll.publishedAt?.getTime() ?? 0),
		)
		.map((result) => {
			const votesByOption = new Map(
				result.tally.map((item) => [item.optionId, item.votes]),
			);
			return {
				id: result.poll.id,
				question: result.poll.question,
				totalVotes: result.totalVotes,
				votedFor: null,
				options: result.poll.options.map((option) => ({
					id: option.id,
					label: option.label,
					percentage: percentage(
						votesByOption.get(option.id) ?? 0,
						result.totalVotes,
					),
				})),
			};
		});
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
