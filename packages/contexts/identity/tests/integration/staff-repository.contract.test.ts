import { newPrismaClient } from "@portal-app/db/client";
import {
	AuthorProfile,
	InMemoryStaffRepository,
	StaffMember,
	type StaffMemberRepository,
	type StaffStatus,
} from "@portal-app/identity";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

type Harness = {
	repo: StaffMemberRepository;
	/** Garante o `user` que o `staff_member` referencia (FK 1:1). */
	seedUser: (id: string, email: string) => Promise<void>;
	reset: () => Promise<void>;
};

function fakeHarness(): Harness {
	const repo = new InMemoryStaffRepository();
	return {
		repo,
		seedUser: () => Promise.resolve(),
		reset: () => {
			repo.clear();
			return Promise.resolve();
		},
	};
}

function prismaHarness(): Harness {
	return {
		repo: new PrismaStaffRepository(prisma),
		seedUser: async (id, email) => {
			await prisma.user.upsert({
				where: { id },
				create: { id, name: "Usuário", email },
				update: {},
			});
		},
		reset: async () => {
			await prisma.staffMember.deleteMany();
			await prisma.user.deleteMany();
		},
	};
}

function staffAt(id: string, email: string, status: StaffStatus): StaffMember {
	return StaffMember.restore({
		id,
		email,
		role: "REDATOR",
		status,
		sectionIds: [],
	});
}

/**
 * Uma única suíte de contrato, rodada contra o fake e contra o Prisma. É o que
 * legitima usar o fake nos testes de aplicação: se ambos passam, o fake é fiel.
 */
function contract(label: string, makeHarness: () => Harness): void {
	describe(`StaffMemberRepository — contrato (${label})`, () => {
		let h: Harness;

		beforeEach(async () => {
			h = makeHarness();
			await h.reset();
		});

		it("I07: salva e recupera por id e por email", async () => {
			await h.seedUser("staff-1", "editor@x.com");
			await h.repo.save(
				StaffMember.restore({
					id: "staff-1",
					email: "editor@x.com",
					role: "EDITOR",
					status: "ATIVO",
					sectionIds: ["politica", "cidades"],
					authorProfile: AuthorProfile.create({
						bio: "Cobre política",
						title: "Editor",
						socials: { twitter: "@ed" },
					}),
				}),
			);

			const byId = await h.repo.findById("staff-1");
			expect(byId?.role).toBe("EDITOR");
			expect([...(byId?.sectionIds ?? [])]).toEqual(["politica", "cidades"]);
			expect(byId?.authorProfile.bio).toBe("Cobre política");
			expect(byId?.authorProfile.socials).toEqual({ twitter: "@ed" });

			const byEmail = await h.repo.findByEmail("editor@x.com");
			expect(byEmail?.id).toBe("staff-1");
		});

		it("I08: desativar mantém o mesmo id e não duplica (autoria preservada)", async () => {
			await h.seedUser("staff-1", "a@x.com");
			await h.repo.save(staffAt("staff-1", "a@x.com", "ATIVO"));
			await h.repo.save(staffAt("staff-1", "a@x.com", "INATIVO"));

			const loaded = await h.repo.findById("staff-1");
			expect(loaded?.status).toBe("INATIVO");
			expect(loaded?.id).toBe("staff-1");
			expect(await h.repo.list()).toHaveLength(1);
		});

		it("findById inexistente devolve null", async () => {
			expect(await h.repo.findById("nao-existe")).toBeNull();
		});
	});
}

contract("in-memory", fakeHarness);
contract("prisma", prismaHarness);
