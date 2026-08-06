import { describe, expect, it } from "vitest";

import {
	INVITATION_VALIDITY_DAYS,
	InvalidInviteEmail,
	Invitation,
	InvitationAlreadyAccepted,
	InvitationExpired,
	normalizeEmail,
} from "../../src/index";

const NOW = new Date("2026-08-06T12:00:00-03:00");

function novo(
	overrides: Partial<Parameters<typeof Invitation.create>[0]> = {},
) {
	return Invitation.create({
		id: "inv-1",
		email: "jornalista@fm7cidades.com",
		role: "REDATOR",
		invitedBy: "admin-1",
		now: NOW,
		...overrides,
	});
}

describe("Invitation.create", () => {
	it("nasce aberto e com validade padrão", () => {
		const invitation = novo().unwrap();

		expect(invitation.isOpen(NOW)).toBe(true);
		expect(invitation.acceptedAt).toBeNull();
		expect(invitation.expiresAt.getTime()).toBe(
			NOW.getTime() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
		);
	});

	it("normaliza o e-mail — é chave de comparação, não texto livre", () => {
		const invitation = novo({ email: "  Joao@FM7Cidades.COM  " }).unwrap();

		// Sem isto, um convite para "Joao@X.com" não casaria com um cadastro em
		// "joao@x.com" e o convite simplesmente não funcionaria.
		expect(invitation.email).toBe("joao@fm7cidades.com");
	});

	it.each(["sem-arroba", "vazio@", "@sem-usuario", "  ", "a@b"])(
		"recusa e-mail inválido: %s",
		(email) => {
			expect(novo({ email }).unwrapErr()).toBeInstanceOf(InvalidInviteEmail);
		},
	);

	it("guarda papel e editorias do convite", () => {
		const invitation = novo({
			role: "EDITOR",
			sectionIds: ["sec-1", "sec-2"],
		}).unwrap();

		expect(invitation.role).toBe("EDITOR");
		expect([...invitation.sectionIds]).toEqual(["sec-1", "sec-2"]);
	});

	it("aceita validade customizada", () => {
		const invitation = novo({ validityDays: 1 }).unwrap();

		expect(invitation.isOpen(new Date(NOW.getTime() + 23 * 3600_000))).toBe(
			true,
		);
		expect(invitation.isOpen(new Date(NOW.getTime() + 25 * 3600_000))).toBe(
			false,
		);
	});
});

describe("Invitation.accept", () => {
	it("consome o convite", () => {
		const invitation = novo().unwrap();

		expect(invitation.accept(NOW).isOk()).toBe(true);
		expect(invitation.isAccepted()).toBe(true);
		expect(invitation.isOpen(NOW)).toBe(false);
	});

	it("recusa o segundo uso — um convite, uma conta", () => {
		const invitation = novo().unwrap();
		invitation.accept(NOW);

		expect(invitation.accept(NOW).unwrapErr()).toBeInstanceOf(
			InvitationAlreadyAccepted,
		);
	});

	it("recusa convite vencido", () => {
		const invitation = novo().unwrap();
		const depois = new Date(
			NOW.getTime() + (INVITATION_VALIDITY_DAYS + 1) * 24 * 3600_000,
		);

		expect(invitation.accept(depois).unwrapErr()).toBeInstanceOf(
			InvitationExpired,
		);
		expect(invitation.isAccepted()).toBe(false);
	});

	it("o instante exato do vencimento já está vencido", () => {
		const invitation = novo().unwrap();

		expect(invitation.isExpired(invitation.expiresAt)).toBe(true);
	});
});

describe("Invitation.fromPersistence", () => {
	it("reidrata sem validar — o que já está guardado não se recusa", () => {
		const invitation = Invitation.fromPersistence("inv-9", {
			email: "  ALGUEM@X.COM ",
			role: "EDITOR",
			sectionIds: ["s1"],
			expiresAt: new Date(NOW.getTime() + 3600_000),
			acceptedAt: null,
			invitedBy: "admin-1",
		});

		expect(invitation.email).toBe("alguem@x.com");
		expect(invitation.role).toBe("EDITOR");
		expect(invitation.isOpen(NOW)).toBe(true);
	});

	it("papel desconhecido no banco cai no menos privilegiado", () => {
		const invitation = Invitation.fromPersistence("inv-9", {
			email: "a@b.com",
			role: "SUPER_ADMIN_INVENTADO",
			sectionIds: [],
			expiresAt: NOW,
			acceptedAt: null,
			invitedBy: "admin-1",
		});

		// Cair para REDATOR e não para ADMIN: diante de dado corrompido, o erro
		// seguro é conceder menos, não mais.
		expect(invitation.role).toBe("REDATOR");
	});
});

describe("normalizeEmail", () => {
	it("apara e baixa a caixa", () => {
		expect(normalizeEmail("  MiXeD@Case.Com ")).toBe("mixed@case.com");
	});
});
