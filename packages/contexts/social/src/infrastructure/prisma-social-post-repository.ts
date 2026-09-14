import type { PrismaClient } from "@portal-app/db/client";
import type { Page, PageRequest } from "@portal-app/shared-kernel";

import { Caption } from "../domain/caption";
import { Delivery, type DeliveryStatus } from "../domain/delivery";
import type { SocialDestination } from "../domain/platform";
import type {
	SocialPostFilter,
	SocialPostRepository,
} from "../domain/ports/social-post-repository";
import {
	type ArtSelections,
	type PostOrigin,
	type PostStatus,
	SocialPost,
} from "../domain/social-post";
import type { ArtContent } from "../domain/template/fit-text";

/** As origens que fazem de um post "o post da matéria". */
const ARTICLE_ORIGINS: PostOrigin[] = ["AUTOMATICA", "MATERIA"];

/** Adapter Prisma dos posts. Única camada que conhece Prisma. */
export class PrismaSocialPostRepository implements SocialPostRepository {
	constructor(private readonly prisma: PrismaClient) {}

	/**
	 * Grava o post, as entregas e os eventos — tudo na MESMA transação.
	 *
	 * É o mesmo arranjo do `PrismaArticleRepository`: o evento entra no outbox
	 * junto com o agregado, então não existe "publicou mas não registrou". O
	 * despacho fica para o relay, depois.
	 */
	async save(post: SocialPost): Promise<void> {
		const events = post.pullEvents();
		const data = toPersistence(post);
		const platforms = [...post.targets];

		await this.prisma.$transaction(async (tx) => {
			await tx.socialPost.upsert({
				where: { id: post.id },
				create: data,
				update: data,
			});

			for (const delivery of post.deliveries) {
				const row = {
					postId: post.id,
					platform: delivery.destination,
					status: delivery.status,
					remoteId: delivery.remoteId,
					permalink: delivery.permalink,
					error: delivery.error,
					attempts: delivery.attempts,
					lastAttemptAt: delivery.lastAttemptAt,
				};
				await tx.socialDelivery.upsert({
					where: {
						postId_platform: {
							postId: post.id,
							platform: delivery.destination,
						},
					},
					create: row,
					update: row,
				});
			}

			// Redes tiradas do rascunho somem. Só acontece antes da aprovação (o
			// agregado recusa `edit` depois dela), então nunca há `remoteId` aqui
			// para se perder.
			await tx.socialDelivery.deleteMany({
				where: { postId: post.id, platform: { notIn: platforms } },
			});

			if (events.length > 0) {
				await tx.outboxEvent.createMany({
					data: events.map((event) => ({
						aggregateId: post.id,
						eventName: event.eventName,
						// Serialização plana: Date vira ISO, métodos somem — pronto p/ Json.
						payload: JSON.parse(JSON.stringify(event)),
						occurredAt: event.occurredAt,
					})),
				});
			}
		});
	}

	async findById(id: string): Promise<SocialPost | null> {
		const row = await this.prisma.socialPost.findUnique({
			where: { id },
			include: { deliveries: true },
		});
		return row ? toDomain(row) : null;
	}

	async list(
		filter: SocialPostFilter,
		page: PageRequest,
	): Promise<Page<SocialPost>> {
		const where = whereFrom(filter);
		const [rows, total] = await Promise.all([
			this.prisma.socialPost.findMany({
				where,
				include: { deliveries: true },
				orderBy: { createdAt: "desc" },
				take: page.limit,
				skip: page.offset,
			}),
			this.prisma.socialPost.count({ where }),
		]);
		return { items: rows.map(toDomain), total };
	}

	async existsForArticle(articleId: string): Promise<boolean> {
		const count = await this.prisma.socialPost.count({
			where: {
				articleId,
				// O automático e o preparado no editor da matéria contam. Um post
				// MANUAL sobre a mesma matéria é intenção ("republica aquela de
				// ontem"), não duplicata.
				origin: { in: ARTICLE_ORIGINS },
			},
		});
		return count > 0;
	}

	async findForArticle(articleId: string): Promise<SocialPost | null> {
		const row = await this.prisma.socialPost.findFirst({
			where: { articleId, origin: { in: ARTICLE_ORIGINS } },
			include: { deliveries: true },
			orderBy: { createdAt: "desc" },
		});
		return row ? toDomain(row) : null;
	}

	countPending(): Promise<number> {
		return this.prisma.socialPost.count({ where: { status: "RASCUNHO" } });
	}

	async listAwaitingDelivery(limit: number): Promise<readonly SocialPost[]> {
		const rows = await this.prisma.socialPost.findMany({
			where: {
				status: "PUBLICANDO",
				deliveries: { some: { status: "PENDENTE" } },
			},
			include: { deliveries: true },
			// O mais antigo primeiro: quem espera há mais tempo sai antes. Com o
			// teto de `limit`, a ordem inversa deixaria um post preso para sempre
			// atrás de uma enxurrada de novos.
			orderBy: { approvedAt: "asc" },
			take: limit,
		});
		return rows.map(toDomain);
	}
}

type DeliveryRow = {
	platform: string;
	status: string;
	remoteId: string | null;
	permalink: string | null;
	error: string | null;
	attempts: number;
	lastAttemptAt: Date | null;
};

type PostRow = {
	id: string;
	articleId: string | null;
	origin: string;
	caption: string;
	mediaIds: string[];
	linkUrl: string | null;
	status: string;
	createdAt: Date;
	approvedAt: Date | null;
	approvedByStaffId: string | null;
	art: unknown;
	artContent: unknown;
	deliveries: DeliveryRow[];
};

function toPersistence(post: SocialPost) {
	return {
		id: post.id,
		articleId: post.articleId,
		origin: post.origin,
		// A trava de duplicata do gatilho, no banco. Nulo no post manual — e em
		// Postgres o índice único ignora nulos, então posts manuais continuam
		// ilimitados por matéria.
		// O preparado no editor da matéria também trava (spec 09, F6): um só post
		// da matéria, venha do gatilho ou de uma pessoa.
		autoKey: post.origin !== "MANUAL" ? post.articleId : null,
		caption: post.caption.value,
		mediaIds: [...post.mediaIds],
		linkUrl: post.linkUrl,
		status: post.status,
		createdAt: post.createdAt,
		approvedAt: post.approvedAt,
		approvedByStaffId: post.approvedByStaffId,
		// Serialização plana, como os eventos: o que entra no Json é exatamente a
		// cópia do padrão que o agregado guarda.
		art: JSON.parse(JSON.stringify(post.artSelections)),
		// `{}` é "sem conteúdo" — a coluna não é nula, e ler de volta devolve null.
		artContent: post.artContent ? { ...post.artContent } : {},
	};
}

function toDomain(row: PostRow): SocialPost {
	return SocialPost.restore({
		id: row.id,
		articleId: row.articleId,
		origin: row.origin as PostOrigin,
		caption: Caption.restore(row.caption),
		mediaIds: row.mediaIds,
		linkUrl: row.linkUrl,
		status: row.status as PostStatus,
		createdAt: row.createdAt,
		approvedAt: row.approvedAt,
		approvedByStaffId: row.approvedByStaffId,
		// Só este repositório escreve as duas colunas, sempre a partir do agregado
		// — a leitura confia na forma, como `restore` confia.
		art: (isObject(row.art) ? row.art : {}) as ArtSelections,
		artContent: artContentFrom(row.artContent),
		deliveries: row.deliveries
			// Ordem ESTÁVEL: a tela lista as redes sempre na mesma sequência, e um
			// `findMany` sem ordenação não a garante entre consultas.
			.sort((a, b) => a.platform.localeCompare(b.platform))
			.map((delivery) =>
				Delivery.restore({
					destination: delivery.platform as SocialDestination,
					status: delivery.status as DeliveryStatus,
					remoteId: delivery.remoteId,
					permalink: delivery.permalink,
					error: delivery.error,
					attempts: delivery.attempts,
					lastAttemptAt: delivery.lastAttemptAt,
				}),
			),
	});
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `{}` (ou qualquer coisa sem título) é "sem conteúdo". */
function artContentFrom(value: unknown): ArtContent | null {
	if (!isObject(value) || typeof value.headline !== "string") {
		return null;
	}
	return {
		headline: value.headline,
		kicker: typeof value.kicker === "string" ? value.kicker : null,
		sectionName:
			typeof value.sectionName === "string" ? value.sectionName : null,
	};
}

function whereFrom(filter: SocialPostFilter) {
	return {
		...(filter.status ? { status: filter.status } : {}),
		...(filter.articleId ? { articleId: filter.articleId } : {}),
		...(filter.platform
			? { deliveries: { some: { platform: filter.platform } } }
			: {}),
	};
}
