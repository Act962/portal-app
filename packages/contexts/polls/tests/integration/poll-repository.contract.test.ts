import { newPrismaClient } from "@portal-app/db/client";
import {
	AlreadyVoted,
	InMemoryPollRepository,
	Poll,
	type PollRepository,
} from "@portal-app/polls";
import { PrismaPollRepository } from "@portal-app/polls/infrastructure/prisma-poll-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

const NOW = new Date("2026-08-07T12:00:00-03:00");

function novaEnquete(id = "poll-1"): Poll {
	return Poll.create({
		id,
		question: "Você aprova a nova faixa de ônibus?",
		options: [
			{ id: `${id}-o1`, label: "Aprovo" },
			{ id: `${id}-o2`, label: "Desaprovo" },
		],
	}).unwrap();
}

type Harness = { repo: PollRepository; reset: () => Promise<void> };

function fake(): Harness {
	const repo = new InMemoryPollRepository();
	return { repo, reset: () => Promise.resolve(repo.clear()) };
}

function prismaHarness(): Harness {
	return {
		repo: new PrismaPollRepository(prisma),
		reset: async () => {
			await prisma.pollVote.deleteMany();
			await prisma.pollOption.deleteMany();
			await prisma.poll.deleteMany();
		},
	};
}

function contract(label: string, make: () => Harness): void {
	describe(`PollRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = make();
			await h.reset();
		});

		it("salva a enquete com as opções e as recupera na ordem", async () => {
			await h.repo.save(novaEnquete());

			const loaded = await h.repo.findById("poll-1");
			expect(loaded?.question).toBe("Você aprova a nova faixa de ônibus?");
			expect(loaded?.options.map((o) => o.label)).toEqual([
				"Aprovo",
				"Desaprovo",
			]);
			expect(loaded?.status).toBe("RASCUNHO");
		});

		it("save é upsert — salvar de novo atualiza, não duplica", async () => {
			const poll = novaEnquete();
			await h.repo.save(poll);

			poll.publish(NOW);
			await h.repo.save(poll);

			expect(await h.repo.list()).toHaveLength(1);
			expect((await h.repo.findById("poll-1"))?.status).toBe("PUBLICADA");
		});

		it("trocar as opções do rascunho remove as antigas", async () => {
			const poll = novaEnquete();
			await h.repo.save(poll);

			poll.update({
				options: [
					{ id: "nova-1", label: "Talvez" },
					{ id: "nova-2", label: "Sei lá" },
				],
			});
			await h.repo.save(poll);

			const loaded = await h.repo.findById("poll-1");
			expect(loaded?.options.map((o) => o.id)).toEqual(["nova-1", "nova-2"]);
		});

		it("findPublished acha só a que está no ar", async () => {
			const rascunho = novaEnquete("rascunho");
			await h.repo.save(rascunho);

			expect(await h.repo.findPublished()).toBeNull();

			const publicada = novaEnquete("publicada");
			publicada.publish(NOW);
			await h.repo.save(publicada);

			expect((await h.repo.findPublished())?.id).toBe("publicada");
		});

		// `publishPoll` fecha a anterior antes de publicar a nova, então duas no ar
		// não deveria acontecer pelo caminho normal. Mas "não deveria" não é
		// garantia: uma corrida entre dois editores, ou um UPDATE feito à mão no
		// banco, chega lá. As duas implementações precisam concordar em QUAL
		// aparece no portal — a publicada por último —, senão o leitor vê uma
		// enquete diferente conforme o ambiente.
		it("com duas no ar, devolve a publicada por último", async () => {
			const antiga = novaEnquete("antiga");
			antiga.publish(new Date("2026-08-01T09:00:00-03:00"));
			await h.repo.save(antiga);

			const recente = novaEnquete("recente");
			recente.publish(NOW);
			await h.repo.save(recente);

			expect((await h.repo.findPublished())?.id).toBe("recente");
		});

		it("conta os votos por opção", async () => {
			const poll = novaEnquete();
			poll.publish(NOW);
			await h.repo.save(poll);

			await h.repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-1",
				now: NOW,
			});
			await h.repo.recordVote({
				id: "v2",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-2",
				now: NOW,
			});
			await h.repo.recordVote({
				id: "v3",
				pollId: "poll-1",
				optionId: "poll-1-o2",
				voterToken: "leitor-3",
				now: NOW,
			});

			const tally = await h.repo.tally("poll-1");
			expect(tally.find((t) => t.optionId === "poll-1-o1")?.votes).toBe(2);
			expect(tally.find((t) => t.optionId === "poll-1-o2")?.votes).toBe(1);
		});

		it("o MESMO leitor não vota duas vezes na mesma enquete", async () => {
			const poll = novaEnquete();
			poll.publish(NOW);
			await h.repo.save(poll);

			const primeiro = await h.repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-1",
				now: NOW,
			});
			const segundo = await h.repo.recordVote({
				id: "v2",
				pollId: "poll-1",
				optionId: "poll-1-o2",
				voterToken: "leitor-1",
				now: NOW,
			});

			expect(primeiro).toBeNull();
			expect(segundo).toBeInstanceOf(AlreadyVoted);
			expect(
				(await h.repo.tally("poll-1")).reduce((t, i) => t + i.votes, 0),
			).toBe(1);
		});

		it("o mesmo leitor pode votar em enquetes DIFERENTES", async () => {
			for (const id of ["poll-1", "poll-2"]) {
				const poll = novaEnquete(id);
				poll.publish(NOW);
				await h.repo.save(poll);
			}

			const primeiro = await h.repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-1",
				now: NOW,
			});
			const segundo = await h.repo.recordVote({
				id: "v2",
				pollId: "poll-2",
				optionId: "poll-2-o1",
				voterToken: "leitor-1",
				now: NOW,
			});

			expect(primeiro).toBeNull();
			expect(segundo).toBeNull();
		});

		it("findVote diz em qual opção o leitor votou", async () => {
			const poll = novaEnquete();
			poll.publish(NOW);
			await h.repo.save(poll);
			await h.repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o2",
				voterToken: "leitor-1",
				now: NOW,
			});

			expect(await h.repo.findVote("poll-1", "leitor-1")).toBe("poll-1-o2");
			expect(await h.repo.findVote("poll-1", "outro-leitor")).toBeNull();
		});

		it("excluir a enquete leva junto opções e votos", async () => {
			const poll = novaEnquete();
			poll.publish(NOW);
			await h.repo.save(poll);
			await h.repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-1",
				now: NOW,
			});

			await h.repo.delete("poll-1");

			expect(await h.repo.findById("poll-1")).toBeNull();
			expect(await h.repo.tally("poll-1")).toEqual([]);
		});

		it("busca inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fake);
contract("prisma", prismaHarness);

describe("PrismaPollRepository — concorrência", () => {
	beforeEach(async () => {
		await prisma.pollVote.deleteMany();
		await prisma.pollOption.deleteMany();
		await prisma.poll.deleteMany();
	});

	it("dois votos SIMULTÂNEOS do mesmo leitor: só um entra", async () => {
		// É por isto que a garantia vive na chave única do banco, e não numa
		// leitura antes do insert — entre o `findVote` e o `create` cabe um
		// segundo clique, e este teste passa exatamente por essa fresta.
		const repo = new PrismaPollRepository(prisma);
		const poll = novaEnquete();
		poll.publish(NOW);
		await repo.save(poll);

		const resultados = await Promise.all([
			repo.recordVote({
				id: "v1",
				pollId: "poll-1",
				optionId: "poll-1-o1",
				voterToken: "leitor-apressado",
				now: NOW,
			}),
			repo.recordVote({
				id: "v2",
				pollId: "poll-1",
				optionId: "poll-1-o2",
				voterToken: "leitor-apressado",
				now: NOW,
			}),
		]);

		const recusados = resultados.filter((r) => r instanceof AlreadyVoted);
		expect(recusados).toHaveLength(1);
		expect((await repo.tally("poll-1")).reduce((t, i) => t + i.votes, 0)).toBe(1);
	});
});
