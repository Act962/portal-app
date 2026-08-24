import type { PrismaClient } from "@portal-app/db/client";

import { AlreadyVoted } from "../domain/errors";
import { Poll, type PollStatus } from "../domain/poll";
import type {
	PollRepository,
	VoteTally,
} from "../domain/ports/poll-repository";

/**
 * Adapter Prisma da porta `PollRepository`. Única camada que conhece Prisma.
 * Recebe o `PrismaClient` por injeção (não o singleton), o que o torna
 * testável contra o Postgres do Testcontainers no mesmo contrato que o fake.
 */
export class PrismaPollRepository implements PollRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Poll | null> {
		const row = await this.prisma.poll.findUnique({
			where: { id },
			include: { options: { orderBy: { order: "asc" } } },
		});
		return row ? toDomain(row) : null;
	}

	async findPublished(): Promise<Poll | null> {
		const row = await this.prisma.poll.findFirst({
			where: { status: "PUBLICADA" },
			orderBy: { publishedAt: "desc" },
			include: { options: { orderBy: { order: "asc" } } },
		});
		return row ? toDomain(row) : null;
	}

	async list(): Promise<Poll[]> {
		const rows = await this.prisma.poll.findMany({
			orderBy: { createdAt: "desc" },
			include: { options: { orderBy: { order: "asc" } } },
		});
		return rows.map(toDomain);
	}

	async save(poll: Poll): Promise<void> {
		const data = {
			question: poll.question,
			status: poll.status,
			publishedAt: poll.publishedAt,
		};

		// Numa transação: as opções são parte do agregado, então gravar a
		// enquete sem elas (ou vice-versa) deixaria estado inválido no banco.
		await this.prisma.$transaction(async (tx) => {
			await tx.poll.upsert({
				where: { id: poll.id },
				create: { id: poll.id, ...data },
				update: data,
			});

			const keptIds = poll.options.map((option) => option.id);
			// Some as opções que saíram (só acontece em rascunho — o domínio
			// tranca a edição depois de publicada).
			await tx.pollOption.deleteMany({
				where: { pollId: poll.id, id: { notIn: keptIds } },
			});
			for (const option of poll.options) {
				const optionData = {
					pollId: poll.id,
					label: option.label,
					order: option.order,
				};
				await tx.pollOption.upsert({
					where: { id: option.id },
					create: { id: option.id, ...optionData },
					update: optionData,
				});
			}
		});
	}

	async delete(id: string): Promise<void> {
		// Opções e votos saem junto (onDelete: Cascade no schema).
		await this.prisma.poll.delete({ where: { id } });
	}

	async tally(pollId: string): Promise<VoteTally[]> {
		const rows = await this.prisma.pollVote.groupBy({
			by: ["optionId"],
			where: { pollId },
			_count: { _all: true },
		});
		return rows.map((row) => ({
			optionId: row.optionId,
			votes: row._count._all,
		}));
	}

	async recordVote(input: {
		id: string;
		pollId: string;
		optionId: string;
		voterToken: string;
		now: Date;
	}): Promise<AlreadyVoted | null> {
		try {
			await this.prisma.pollVote.create({
				data: {
					id: input.id,
					pollId: input.pollId,
					optionId: input.optionId,
					voterToken: input.voterToken,
					createdAt: input.now,
				},
			});
			return null;
		} catch (error) {
			// P2002 = violação de chave única (`pollId + voterToken`): este leitor
			// já votou. É resultado esperado, não falha — por isso vira valor.
			if (isUniqueViolation(error)) {
				return new AlreadyVoted();
			}
			throw error;
		}
	}

	async findVote(pollId: string, voterToken: string): Promise<string | null> {
		const vote = await this.prisma.pollVote.findUnique({
			where: { pollId_voterToken: { pollId, voterToken } },
			select: { optionId: true },
		});
		return vote?.optionId ?? null;
	}
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: unknown }).code === "P2002"
	);
}

type PollRow = {
	id: string;
	question: string;
	status: string;
	publishedAt: Date | null;
	options: Array<{ id: string; label: string; order: number }>;
};

function toDomain(row: PollRow): Poll {
	return Poll.restore({
		id: row.id,
		question: row.question,
		options: row.options.map((option) => ({
			id: option.id,
			label: option.label,
			order: option.order,
		})),
		status: row.status as PollStatus,
		publishedAt: row.publishedAt,
	});
}
