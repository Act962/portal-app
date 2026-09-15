import { SocialAccount } from "@portal-app/social";
import {
	ENVIRONMENT_INSTAGRAM_ACCOUNT_ID,
	type EnvironmentInstagram,
	EnvironmentInstagramAccountRepository,
	environmentInstagramFrom,
} from "@portal-app/social/infrastructure/environment-instagram";
import { describe, expect, it } from "vitest";

import { InMemorySocialAccountRepository } from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

describe("environmentInstagramFrom", () => {
	it("sem as variáveis, o modo fica desligado — sem erro", () => {
		expect(environmentInstagramFrom({}).unwrap()).toBeNull();
		expect(
			environmentInstagramFrom({ accessToken: "  ", userId: "" }).unwrap(),
		).toBeNull();
	});

	it("lê token, id, usuário sem @ e validade", () => {
		expect(
			environmentInstagramFrom({
				accessToken: " IGAAtoken ",
				userId: "17841400000000001",
				username: "@radio7cidades",
				tokenExpiresAt: "2026-11-13",
			}).unwrap(),
		).toEqual({
			accessToken: "IGAAtoken",
			userId: "17841400000000001",
			username: "radio7cidades",
			// Fim do dia em UTC: meia-noite UTC ainda é dia 12 no Brasil.
			tokenExpiresAt: new Date("2026-11-13T23:59:59Z"),
		});
	});

	it("data com horário é respeitada como veio", () => {
		expect(
			environmentInstagramFrom({
				accessToken: "IGAA",
				userId: "1784",
				tokenExpiresAt: "2026-11-13T10:00:00-03:00",
			}).unwrap()?.tokenExpiresAt,
		).toEqual(new Date("2026-11-13T13:00:00Z"));
	});

	it("usuário e validade são opcionais", () => {
		expect(
			environmentInstagramFrom({
				accessToken: "IGAA",
				userId: "1784",
			}).unwrap(),
		).toEqual({
			accessToken: "IGAA",
			userId: "1784",
			username: null,
			tokenExpiresAt: null,
		});
	});

	it("só uma das duas obrigatórias é erro, e diz o que falta", () => {
		// Meia configuração não liga nada: token certo no id errado publicaria em
		// outro lugar.
		expect(
			environmentInstagramFrom({ accessToken: "IGAA" }).unwrapErr(),
		).toContain("META_INSTAGRAM_USER_ID");
		expect(environmentInstagramFrom({ userId: "1784" }).unwrapErr()).toContain(
			"META_INSTAGRAM_ACCESS_TOKEN",
		);
	});

	it("id que não é número é erro — o @ vai em META_INSTAGRAM_USERNAME", () => {
		expect(
			environmentInstagramFrom({
				accessToken: "IGAA",
				userId: "@radio7cidades",
			}).unwrapErr(),
		).toContain("id numérico");
	});

	it("data de validade inválida é erro", () => {
		expect(
			environmentInstagramFrom({
				accessToken: "IGAA",
				userId: "1784",
				tokenExpiresAt: "13/11/2026",
			}).unwrapErr(),
		).toContain("AAAA-MM-DD");
	});
});

const instagram: EnvironmentInstagram = {
	userId: "17841400000000001",
	accessToken: "IGAA-TOKEN-DO-ENV",
	username: "radio7cidades",
	tokenExpiresAt: new Date("2026-11-13T00:00:00Z"),
};

function contaNoBanco(
	platform: "INSTAGRAM" | "FACEBOOK",
	id = `acc-${platform}`,
) {
	return SocialAccount.connect({
		id,
		platform,
		remoteId: `remote-${platform}`,
		displayName: `do banco ${platform}`,
		tokenExpiresAt: null,
		connectedAt: AGORA,
		connectedByStaffId: "admin-1",
	});
}

describe("EnvironmentInstagramAccountRepository", () => {
	it("o Instagram vem do ambiente, com o token do .env", async () => {
		const repo = new EnvironmentInstagramAccountRepository(
			new InMemorySocialAccountRepository(),
			instagram,
		);

		const account = await repo.findByPlatform("INSTAGRAM");
		expect(account?.id).toBe(ENVIRONMENT_INSTAGRAM_ACCOUNT_ID);
		expect(account?.remoteId).toBe("17841400000000001");
		expect(account?.displayName).toBe("@radio7cidades");
		expect(account?.tokenExpiresAt).toEqual(instagram.tokenExpiresAt);
		expect(account?.isUsableAt(AGORA)).toBe(true);

		expect(await repo.credentialsFor("INSTAGRAM")).toEqual({
			accountId: ENVIRONMENT_INSTAGRAM_ACCOUNT_ID,
			platform: "INSTAGRAM",
			accountRemoteId: "17841400000000001",
			accessToken: "IGAA-TOKEN-DO-ENV",
		});
		expect(repo.isManagedByEnvironment("INSTAGRAM")).toBe(true);
	});

	it("o token do .env NÃO aparece no agregado", async () => {
		const repo = new EnvironmentInstagramAccountRepository(
			new InMemorySocialAccountRepository(),
			instagram,
		);
		expect(
			JSON.stringify(await repo.findByPlatform("INSTAGRAM")),
		).not.toContain("IGAA-TOKEN-DO-ENV");
	});

	it("sem usuário, mostra o id em vez de @null", async () => {
		const repo = new EnvironmentInstagramAccountRepository(
			new InMemorySocialAccountRepository(),
			{ ...instagram, username: null },
		);
		expect((await repo.findByPlatform("INSTAGRAM"))?.displayName).toBe(
			"Instagram 17841400000000001",
		);
	});

	it("validade vencida no .env faz a conta parar de publicar", async () => {
		const repo = new EnvironmentInstagramAccountRepository(
			new InMemorySocialAccountRepository(),
			{ ...instagram, tokenExpiresAt: new Date("2026-09-01T00:00:00Z") },
		);
		const account = await repo.findByPlatform("INSTAGRAM");
		expect(account?.stateAt(AGORA)).toBe("EXPIRADA");
	});

	it("o Facebook continua vindo do banco", async () => {
		const inner = new InMemorySocialAccountRepository();
		const facebook = contaNoBanco("FACEBOOK");
		await inner.connect(facebook, "token-da-pagina");
		const repo = new EnvironmentInstagramAccountRepository(inner, instagram);

		expect(await repo.findByPlatform("FACEBOOK")).toBe(facebook);
		expect((await repo.credentialsFor("FACEBOOK"))?.accessToken).toBe(
			"token-da-pagina",
		);
		expect(repo.isManagedByEnvironment("FACEBOOK")).toBe(false);
	});

	it("a lista traz o Instagram do ambiente no lugar de um Instagram do banco", async () => {
		const inner = new InMemorySocialAccountRepository();
		await inner.connect(contaNoBanco("INSTAGRAM"), "antigo");
		await inner.connect(contaNoBanco("FACEBOOK"), "fb");
		const repo = new EnvironmentInstagramAccountRepository(inner, instagram);

		const ids = (await repo.listAll()).map((account) => account.id);
		expect(ids).toEqual([ENVIRONMENT_INSTAGRAM_ACCOUNT_ID, "acc-FACEBOOK"]);
	});

	it("conectar ou salvar o Instagram pelo login é ignorado — a verdade é o .env", async () => {
		// Sem isso, o login da Meta criaria uma segunda conta de Instagram que o
		// painel mostraria e o worker não usaria.
		const inner = new InMemorySocialAccountRepository();
		const repo = new EnvironmentInstagramAccountRepository(inner, instagram);

		await repo.connect(contaNoBanco("INSTAGRAM"), "token-do-login");
		await repo.save(contaNoBanco("INSTAGRAM"));
		expect(inner.accounts.size).toBe(0);

		await repo.connect(contaNoBanco("FACEBOOK"), "fb");
		expect(inner.accounts.has("FACEBOOK")).toBe(true);
		await repo.save(contaNoBanco("FACEBOOK", "acc-2"));
		expect(inner.accounts.get("FACEBOOK")?.id).toBe("acc-2");
	});

	it("esquecer delega ao banco", async () => {
		const inner = new InMemorySocialAccountRepository();
		await inner.connect(contaNoBanco("FACEBOOK"), "fb");
		const repo = new EnvironmentInstagramAccountRepository(inner, instagram);
		expect(await repo.forget("FACEBOOK")).toBe(true);
		expect(await repo.forget("INSTAGRAM")).toBe(false);
	});

	it("sem o modo ligado, é transparente", async () => {
		const inner = new InMemorySocialAccountRepository();
		const instagramDoBanco = contaNoBanco("INSTAGRAM");
		await inner.connect(instagramDoBanco, "token");
		const repo = new EnvironmentInstagramAccountRepository(inner, null);

		expect(await repo.findByPlatform("INSTAGRAM")).toBe(instagramDoBanco);
		expect(await repo.listAll()).toEqual([instagramDoBanco]);
		expect((await repo.credentialsFor("INSTAGRAM"))?.accessToken).toBe("token");
		expect(repo.isManagedByEnvironment("INSTAGRAM")).toBe(false);
	});
});
