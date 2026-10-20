import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import {
	assertCanSignUp,
	inviteMember,
} from "../../src/application/manage-invitations";
import {
	EditorRequiresSection,
	InvitationAlreadyExists,
	NotInvited,
} from "../../src/domain/errors";
import { InMemoryInvitationRepository } from "../../src/domain/ports/invitation-repository";
import { InMemoryMailer, NoopMailer } from "../../src/domain/ports/mailer";
import { InMemoryStaffRepository } from "../../src/domain/ports/staff-repository";
import { StaffMember } from "../../src/domain/staff-member";

const NOW = new Date("2026-08-06T12:00:00-03:00");

let invitations: InMemoryInvitationRepository;
let mailer: InMemoryMailer;
let deps: {
	invitations: InMemoryInvitationRepository;
	clock: FixedClock;
	ids: SequentialIdGenerator;
	mailer: InMemoryMailer;
	appUrl: string;
};

beforeEach(() => {
	invitations = new InMemoryInvitationRepository();
	mailer = new InMemoryMailer();
	deps = {
		invitations,
		clock: new FixedClock(NOW),
		ids: new SequentialIdGenerator(),
		mailer,
		appUrl: "https://painel.fm7cidades.com",
	};
});

describe("inviteMember — Mailer", () => {
	it("avisa a pessoa convidada por e-mail com o link de login", async () => {
		const result = await inviteMember(
			{ email: "jornalista@fm7cidades.com", role: "REDATOR" },
			"admin-1",
			deps,
		);

		expect(result.isOk()).toBe(true);
		expect(mailer.sent).toHaveLength(1);
		expect(mailer.sent[0]?.to).toBe("jornalista@fm7cidades.com");
		expect(mailer.sent[0]?.text).toContain(
			"https://painel.fm7cidades.com/login",
		);
	});

	it("sem Mailer configurado (NoopMailer), o convite continua funcionando", async () => {
		const result = await inviteMember(
			{ email: "jornalista@fm7cidades.com", role: "REDATOR" },
			"admin-1",
			{ ...deps, mailer: new NoopMailer() },
		);

		expect(result.isOk()).toBe(true);
	});

	it("cria link aberto sem tentar enviar e-mail", async () => {
		const result = await inviteMember(
			{ email: null, role: "REDATOR" },
			"admin-1",
			deps,
		);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().email).toBeNull();
		expect(mailer.sent).toHaveLength(0);
	});

	it("reserva um link aberto para o primeiro e-mail", async () => {
		const invitation = (
			await inviteMember({ email: null, role: "REDATOR" }, "admin-1", deps)
		).unwrap();

		const first = await invitations.claimById(
			invitation.id,
			"primeiro@fm7cidades.com",
			NOW,
		);
		const second = await invitations.claimById(
			invitation.id,
			"segundo@fm7cidades.com",
			NOW,
		);

		expect(first?.claimedEmail).toBe("primeiro@fm7cidades.com");
		expect(second).toBeNull();
	});

	it("convite nominal só pode ser reservado pelo e-mail indicado", async () => {
		const invitation = (
			await inviteMember(
				{ email: "certo@fm7cidades.com", role: "REDATOR" },
				"admin-1",
				deps,
			)
		).unwrap();

		expect(
			await invitations.claimById(invitation.id, "errado@fm7cidades.com", NOW),
		).toBeNull();
	});

	it("convite duplicado não reenvia e-mail", async () => {
		await inviteMember(
			{ email: "jornalista@fm7cidades.com", role: "REDATOR" },
			"admin-1",
			deps,
		);
		mailer.sent.length = 0;

		const result = await inviteMember(
			{ email: "jornalista@fm7cidades.com", role: "REDATOR" },
			"admin-1",
			deps,
		);

		expect(result).toBeErr(InvitationAlreadyExists);
		expect(mailer.sent).toHaveLength(0);
	});

	it("editor precisa ser convidado com ao menos uma editoria", async () => {
		const result = await inviteMember(
			{ email: "editor@fm7cidades.com", role: "EDITOR", sectionIds: [] },
			"admin-1",
			deps,
		);

		expect(result).toBeErr(EditorRequiresSection);
		expect(mailer.sent).toHaveLength(0);
	});
});

describe("assertCanSignUp — token do convite", () => {
	async function staffComAdmin() {
		const staff = new InMemoryStaffRepository();
		await staff.save(
			StaffMember.create({
				id: "admin-1",
				email: "admin@fm7cidades.com",
				role: "ADMIN",
			}),
		);
		return staff;
	}

	it("exige token depois que o primeiro membro já existe", async () => {
		const result = await assertCanSignUp("novo@fm7cidades.com", null, {
			invitations,
			clock: deps.clock,
			staff: await staffComAdmin(),
		});

		expect(result).toBeErr(NotInvited);
	});

	it("reserva link aberto para o primeiro e-mail que apresenta o token", async () => {
		const invitation = (
			await inviteMember({ email: null, role: "REDATOR" }, "admin-1", deps)
		).unwrap();
		const staff = await staffComAdmin();

		const first = await assertCanSignUp(
			"primeiro@fm7cidades.com",
			invitation.id,
			{ invitations, clock: deps.clock, staff },
		);
		const second = await assertCanSignUp(
			"segundo@fm7cidades.com",
			invitation.id,
			{ invitations, clock: deps.clock, staff },
		);

		expect(first.isOk()).toBe(true);
		expect(first.unwrap()?.claimedEmail).toBe("primeiro@fm7cidades.com");
		expect(second).toBeErr(NotInvited);
	});

	it("recusa token nominal apresentado por outro e-mail", async () => {
		const invitation = (
			await inviteMember(
				{ email: "certo@fm7cidades.com", role: "REDATOR" },
				"admin-1",
				deps,
			)
		).unwrap();

		const result = await assertCanSignUp(
			"errado@fm7cidades.com",
			invitation.id,
			{
				invitations,
				clock: deps.clock,
				staff: await staffComAdmin(),
			},
		);

		expect(result).toBeErr(NotInvited);
	});
});
