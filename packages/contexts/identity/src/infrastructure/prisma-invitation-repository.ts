import type { PrismaClient } from "@portal-app/db/client";

import { Invitation } from "../domain/invitation";
import type { InvitationRepository } from "../domain/ports/invitation-repository";

/** Adapter Prisma da porta `InvitationRepository`. */
export class PrismaInvitationRepository implements InvitationRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<Invitation | null> {
		const row = await this.prisma.invitation.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	/**
	 * O convite que ainda vale para este e-mail. O filtro de aberto é feito no
	 * BANCO (não aceito, não vencido) para não trazer histórico à toa — esta
	 * consulta roda em todo cadastro.
	 */
	async findOpenByEmail(email: string, now: Date): Promise<Invitation | null> {
		const row = await this.prisma.invitation.findFirst({
			where: { email, acceptedAt: null, expiresAt: { gt: now } },
			orderBy: { createdAt: "desc" },
		});
		return row ? toDomain(row) : null;
	}

	async list(): Promise<Invitation[]> {
		const rows = await this.prisma.invitation.findMany({
			orderBy: { createdAt: "desc" },
		});
		return rows.map(toDomain);
	}

	async save(invitation: Invitation): Promise<void> {
		const data = {
			email: invitation.email,
			role: invitation.role,
			sectionIds: [...invitation.sectionIds],
			expiresAt: invitation.expiresAt,
			acceptedAt: invitation.acceptedAt,
			invitedBy: invitation.invitedBy,
		};
		await this.prisma.invitation.upsert({
			where: { id: invitation.id },
			create: { id: invitation.id, ...data },
			update: data,
		});
	}

	async delete(id: string): Promise<void> {
		await this.prisma.invitation.delete({ where: { id } });
	}
}

function toDomain(row: {
	id: string;
	email: string;
	role: string;
	sectionIds: string[];
	expiresAt: Date;
	acceptedAt: Date | null;
	invitedBy: string;
}): Invitation {
	return Invitation.fromPersistence(row.id, row);
}
