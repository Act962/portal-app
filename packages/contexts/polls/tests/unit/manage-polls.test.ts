import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import {
	AlreadyVoted,
	closePoll,
	createPoll,
	currentPoll,
	deletePoll,
	InMemoryPollRepository,
	PollNotFound,
	PollNotOpen,
	publishPoll,
	updatePoll,
	vote,
} from "../../src/index";

const NOW = new Date("2026-08-07T12:00:00-03:00");

let repo: InMemoryPollRepository;
let deps: {
	repo: InMemoryPollRepository;
	ids: SequentialIdGenerator;
	clock: FixedClock;
};

beforeEach(() => {
	repo = new InMemoryPollRepository();
	deps = {
		repo,
		ids: new SequentialIdGenerator(),
		clock: new FixedClock(NOW),
	};
});

const INPUT = {
	question: "Você aprova a nova faixa de ônibus?",
	options: ["Aprovo", "Desaprovo"],
};

async function publicada() {
	const poll = (await createPoll(INPUT, deps)).unwrap();
	await publishPoll({ id: poll.id }, deps);
	return (await repo.findById(poll.id)) as NonNullable<
		Awaited<ReturnType<typeof repo.findById>>
	>;
}

describe("createPoll", () => {
	it("cria e persiste como rascunho", async () => {
		const result = await createPoll(INPUT, deps);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().status).toBe("RASCUNHO");
		expect(await repo.list()).toHaveLength(1);
	});

	it("erro de domínio não persiste nada", async () => {
		const result = await createPoll({ ...INPUT, options: ["Só uma"] }, deps);

		expect(result.isErr()).toBe(true);
		expect(await repo.list()).toHaveLength(0);
	});
});

describe("publishPoll", () => {
	it("publica e a enquete passa a ser a corrente", async () => {
		const poll = await publicada();

		expect(poll.status).toBe("PUBLICADA");
		expect((await repo.findPublished())?.id).toBe(poll.id);
	});

	it("publicar uma nova FECHA a que estava no ar", async () => {
		// Sem isto a antiga ficaria viva e invisível, ainda recebendo voto de
		// quem tivesse a página velha aberta.
		const primeira = await publicada();
		const segunda = (
			await createPoll({ ...INPUT, question: "Outra?" }, deps)
		).unwrap();

		await publishPoll({ id: segunda.id }, deps);

		expect((await repo.findById(primeira.id))?.status).toBe("FECHADA");
		expect((await repo.findPublished())?.id).toBe(segunda.id);
	});

	it("id inexistente devolve PollNotFound", async () => {
		expect(await publishPoll({ id: "fantasma" }, deps)).toBeErr(PollNotFound);
	});
});

describe("closePoll", () => {
	it("fecha a enquete no ar", async () => {
		const poll = await publicada();

		expect((await closePoll({ id: poll.id }, deps)).isOk()).toBe(true);
		expect(await repo.findPublished()).toBeNull();
	});
});

describe("deletePoll", () => {
	it("remove a enquete", async () => {
		const poll = (await createPoll(INPUT, deps)).unwrap();

		expect((await deletePoll({ id: poll.id }, deps)).isOk()).toBe(true);
		expect(await repo.findById(poll.id)).toBeNull();
	});

	it("id inexistente devolve PollNotFound", async () => {
		expect(await deletePoll({ id: "fantasma" }, deps)).toBeErr(PollNotFound);
	});
});

describe("updatePoll", () => {
	it("edita o rascunho", async () => {
		const poll = (await createPoll(INPUT, deps)).unwrap();

		await updatePoll({ id: poll.id, question: "Nova pergunta?" }, deps);

		expect((await repo.findById(poll.id))?.question).toBe("Nova pergunta?");
	});
});

describe("vote", () => {
	it("registra o voto e devolve o resultado já atualizado", async () => {
		const poll = await publicada();
		const optionId = poll.options[0]?.id as string;

		const result = await vote(
			{ pollId: poll.id, optionId, voterToken: "leitor-1" },
			deps,
		);

		expect(result.isOk()).toBe(true);
		const value = result.unwrap();
		expect(value.totalVotes).toBe(1);
		expect(value.votedFor).toBe(optionId);
	});

	it("o mesmo leitor não vota duas vezes", async () => {
		const poll = await publicada();
		const [primeira, segunda] = poll.options;

		await vote(
			{ pollId: poll.id, optionId: primeira?.id as string, voterToken: "leitor-1" },
			deps,
		);
		const repetido = await vote(
			{ pollId: poll.id, optionId: segunda?.id as string, voterToken: "leitor-1" },
			deps,
		);

		expect(repetido).toBeErr(AlreadyVoted);
		// E o segundo voto não entrou na contagem.
		expect((await repo.tally(poll.id)).reduce((t, i) => t + i.votes, 0)).toBe(1);
	});

	it("leitores diferentes votam na mesma enquete", async () => {
		const poll = await publicada();
		const optionId = poll.options[0]?.id as string;

		await vote({ pollId: poll.id, optionId, voterToken: "leitor-1" }, deps);
		const segundo = await vote(
			{ pollId: poll.id, optionId, voterToken: "leitor-2" },
			deps,
		);

		expect(segundo.unwrap().totalVotes).toBe(2);
	});

	it("recusa voto em enquete não publicada", async () => {
		const poll = (await createPoll(INPUT, deps)).unwrap();

		const result = await vote(
			{
				pollId: poll.id,
				optionId: poll.options[0]?.id as string,
				voterToken: "leitor-1",
			},
			deps,
		);

		expect(result).toBeErr(PollNotOpen);
	});

	it("enquete inexistente devolve PollNotFound", async () => {
		const result = await vote(
			{ pollId: "fantasma", optionId: "o1", voterToken: "leitor-1" },
			deps,
		);

		expect(result).toBeErr(PollNotFound);
	});
});

describe("currentPoll", () => {
	it("devolve null quando não há enquete no ar", async () => {
		await createPoll(INPUT, deps); // fica em rascunho
		expect(await currentPoll("leitor-1", deps)).toBeNull();
	});

	it("devolve a enquete no ar, sem voto para quem não votou", async () => {
		await publicada();

		const result = await currentPoll("leitor-novo", deps);

		expect(result?.votedFor).toBeNull();
		expect(result?.totalVotes).toBe(0);
	});

	it("diz em qual opção ESTE leitor votou", async () => {
		const poll = await publicada();
		const optionId = poll.options[1]?.id as string;
		await vote({ pollId: poll.id, optionId, voterToken: "leitor-1" }, deps);

		const result = await currentPoll("leitor-1", deps);

		expect(result?.votedFor).toBe(optionId);
	});

	it("leitor sem cookie ainda enxerga a enquete (só não votou)", async () => {
		await publicada();

		const result = await currentPoll(null, deps);

		expect(result).not.toBeNull();
		expect(result?.votedFor).toBeNull();
	});
});
