import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import { inviteMember } from "../../src/application/manage-invitations";
import { InvitationAlreadyExists } from "../../src/domain/errors";
import { InMemoryInvitationRepository } from "../../src/domain/ports/invitation-repository";
import { InMemoryMailer, NoopMailer } from "../../src/domain/ports/mailer";

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
});
