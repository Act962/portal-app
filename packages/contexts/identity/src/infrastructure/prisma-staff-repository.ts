import type { PrismaClient } from "@portal-app/db/client";

import { AuthorProfile } from "../domain/author-profile";
import type { StaffMemberRepository } from "../domain/ports/staff-repository";
import type { Role } from "../domain/role";
import { StaffMember, type StaffStatus } from "../domain/staff-member";

/**
 * Adapter Prisma da porta `StaffMemberRepository`. Vive em `infrastructure/`:
 * é a única camada que conhece Prisma. Recebe o `PrismaClient` por injeção
 * (não usa o singleton), o que o torna testável contra o Postgres do
 * Testcontainers.
 */
export class PrismaStaffRepository implements StaffMemberRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findById(id: string): Promise<StaffMember | null> {
		const row = await this.prisma.staffMember.findUnique({ where: { id } });
		return row ? toDomain(row) : null;
	}

	async findByEmail(email: string): Promise<StaffMember | null> {
		const row = await this.prisma.staffMember.findUnique({ where: { email } });
		return row ? toDomain(row) : null;
	}

	async save(staff: StaffMember): Promise<void> {
		const data = toPersistence(staff);
		await this.prisma.staffMember.upsert({
			where: { id: staff.id },
			create: data,
			update: data,
		});
	}

	async list(): Promise<StaffMember[]> {
		const rows = await this.prisma.staffMember.findMany();
		return rows.map(toDomain);
	}
}

type StaffRow = {
	id: string;
	email: string;
	role: string;
	status: string;
	sectionIds: string[];
	bio: string;
	title: string;
	photoUrl: string | null;
	socials: unknown;
};

function toPersistence(staff: StaffMember) {
	const profile = staff.authorProfile;
	return {
		id: staff.id,
		email: staff.email,
		role: staff.role,
		status: staff.status,
		sectionIds: [...staff.sectionIds],
		bio: profile.bio,
		title: profile.title,
		photoUrl: profile.photoUrl,
		socials: profile.socials,
	};
}

function toDomain(row: StaffRow): StaffMember {
	return StaffMember.restore({
		id: row.id,
		email: row.email,
		role: row.role as Role,
		status: row.status as StaffStatus,
		sectionIds: row.sectionIds,
		authorProfile: AuthorProfile.create({
			bio: row.bio,
			title: row.title,
			photoUrl: row.photoUrl,
			socials: (row.socials ?? {}) as Record<string, string>,
		}),
	});
}
