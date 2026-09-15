import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import {
	connectAccount,
	connectMetaPage,
	disconnectAccount,
	listAccounts,
	type MetaPageChoice,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import { InMemorySocialAccountRepository, staff } from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

let accounts: InMemorySocialAccountRepository;
let deps: {
	accounts: InMemorySocialAccountRepository;
	clock: FixedClock;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	accounts = new InMemorySocialAccountRepository();
	deps = {
		accounts,
		clock: new FixedClock(AGORA),
		ids: new SequentialIdGenerator("acc"),
	};
});

const pagina: MetaPageChoice = {
	pageId: "page-1",
	pageName: "Rádio 7 Cidades",
	pageAccessToken: "TOKEN-DA-PAGINA",
	pagePictureUrl: "https://cdn/p.jpg",
	instagram: {
		id: "ig-1",
		username: "radio7cidades",
		pictureUrl: "https://cdn/ig.jpg",
	},
};

describe("connectMetaPage — um login, duas contas", () => {
	it("conecta a Página e o Instagram vinculado, com o MESMO token de Página", async () => {
		const admin = staff("ADMIN");
		const conectadas = (await connectMetaPage(admin, pagina, deps)).unwrap();

		expect(conectadas.map((a) => a.platform)).toEqual([
			"FACEBOOK",
			"INSTAGRAM",
		]);

		const facebook = await accounts.credentialsFor("FACEBOOK");
		const instagram = await accounts.credentialsFor("INSTAGRAM");
		expect(facebook).toMatchObject({
			accountRemoteId: "page-1",
			accessToken: "TOKEN-DA-PAGINA",
		});
		expect(instagram).toMatchObject({
			accountRemoteId: "ig-1",
			accessToken: "TOKEN-DA-PAGINA",
		});
	});

	it("o Instagram aparece como @usuario e as duas registram quem conectou", async () => {
		const admin = staff("ADMIN");
		const [facebook, instagram] = (
			await connectMetaPage(admin, pagina, deps)
		).unwrap();
		expect(facebook?.displayName).toBe("Rádio 7 Cidades");
		expect(instagram?.displayName).toBe("@radio7cidades");
		expect(instagram?.connectedByStaffId).toBe(admin.id);
		expect(instagram?.avatarUrl).toBe("https://cdn/ig.jpg");
	});

	it("token de Página não expira — tokenExpiresAt nulo nas duas", async () => {
		const conectadas = (
			await connectMetaPage(staff("ADMIN"), pagina, deps)
		).unwrap();
		for (const account of conectadas) {
			expect(account.tokenExpiresAt).toBeNull();
			expect(account.stateAt(AGORA)).toBe("CONECTADA");
		}
	});

	it("Página sem Instagram vinculado conecta só o Facebook", async () => {
		const conectadas = (
			await connectMetaPage(
				staff("ADMIN"),
				{ ...pagina, instagram: null },
				deps,
			)
		).unwrap();
		expect(conectadas.map((a) => a.platform)).toEqual(["FACEBOOK"]);
		expect(await accounts.findByPlatform("INSTAGRAM")).toBeNull();
	});

	it("o EDITOR não conecta — é credencial, não pauta (D11)", async () => {
		expect(
			(await connectMetaPage(staff("EDITOR"), pagina, deps)).unwrapErr().name,
		).toBe("Forbidden");
		expect(accounts.accounts.size).toBe(0);
	});
});

describe("connectAccount, disconnectAccount e listAccounts", () => {
	it("o EDITOR não conecta nem desconecta, mas LISTA", async () => {
		const editor = staff("EDITOR");
		expect(
			(
				await connectAccount(
					editor,
					{
						platform: "FACEBOOK",
						remoteId: "p",
						displayName: "P",
						accessToken: "T",
						tokenExpiresAt: null,
					},
					deps,
				)
			).isErr(),
		).toBe(true);
		expect(
			(await disconnectAccount(editor, { platform: "FACEBOOK" }, deps)).isErr(),
		).toBe(true);
		expect((await listAccounts(editor, deps)).isOk()).toBe(true);
	});

	it("o REDATOR nem lista", async () => {
		expect((await listAccounts(staff("REDATOR"), deps)).unwrapErr().name).toBe(
			"Forbidden",
		);
	});

	it("desconectar mantém o registro e muda o estado", async () => {
		const admin = staff("ADMIN");
		await connectMetaPage(admin, pagina, deps);
		const account = (
			await disconnectAccount(admin, { platform: "INSTAGRAM" }, deps)
		).unwrap();
		expect(account.stateAt(AGORA)).toBe("DESCONECTADA");
		expect((await listAccounts(admin, deps)).unwrap()).toHaveLength(2);
	});

	it("desconectar rede sem conta devolve SocialAccountNotFound", async () => {
		expect(
			(
				await disconnectAccount(staff("ADMIN"), { platform: "FACEBOOK" }, deps)
			).unwrapErr().name,
		).toBe("SocialAccountNotFound");
	});
});
