import {
	closePoll,
	createPoll,
	deletePoll,
	listPolls,
	type Poll,
	type PollResult,
	pollResult,
	publishPoll,
	updatePoll,
} from "@portal-app/polls";
import type { Result } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requirePermission, router } from "../index";
import { pollDeps } from "../polls";

/**
 * Enquetes no painel. Só as mutações do admin vivem aqui (`polls:manage`).
 *
 * Votar e ler a enquete do portal NÃO passam por este router: são um Server
 * Action e uma leitura RSC (`apps/web/src/data`), porque o grupo `(site)` é
 * 100% servidor e não carrega o cliente tRPC — regra do CLAUDE.md.
 */
const manage = requirePermission("polls:manage");

function pollDto(poll: Poll) {
	return {
		id: poll.id,
		question: poll.question,
		status: poll.status,
		publishedAt: poll.publishedAt,
		options: poll.options.map((option) => ({
			id: option.id,
			label: option.label,
			order: option.order,
		})),
	};
}

function resultDto(result: PollResult) {
	const votesByOption = new Map(
		result.tally.map((item) => [item.optionId, item.votes]),
	);
	return {
		...pollDto(result.poll),
		totalVotes: result.totalVotes,
		options: result.poll.options.map((option) => ({
			id: option.id,
			label: option.label,
			order: option.order,
			votes: votesByOption.get(option.id) ?? 0,
		})),
	};
}

function codeFor(error: Error): TRPCError["code"] {
	switch (error.name) {
		case "PollNotFound":
			return "NOT_FOUND";
		case "OptionsLockedAfterPublish":
		case "InvalidPollTransition":
			return "CONFLICT";
		default:
			return "BAD_REQUEST";
	}
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

export const pollsRouter = router({
	list: manage.query(async () => (await listPolls(pollDeps)).map(pollDto)),

	/** Resultado de uma enquete — o painel vê sempre, sem precisar votar. */
	result: manage
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => resultDto(ensure(await pollResult(input, pollDeps)))),

	create: manage
		.input(
			z.object({
				question: z.string(),
				options: z.array(z.string()),
			}),
		)
		.mutation(async ({ input }) => pollDto(ensure(await createPoll(input, pollDeps)))),

	update: manage
		.input(
			z.object({
				id: z.string(),
				question: z.string().optional(),
				options: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ input }) => pollDto(ensure(await updatePoll(input, pollDeps)))),

	publish: manage
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => pollDto(ensure(await publishPoll(input, pollDeps)))),

	close: manage
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => pollDto(ensure(await closePoll(input, pollDeps)))),

	delete: manage
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			ensure(await deletePoll(input, pollDeps));
			return { ok: true };
		}),
});
