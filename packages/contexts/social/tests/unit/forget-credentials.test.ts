import { forgetAllCredentials, SocialAccount } from "@portal-app/social";
import { describe, expect, it } from "vitest";

import { InMemorySocialAccountRepository } from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

function repositorioCom(...platforms: Array<"INSTAGRAM" | "FACEBOOK">) {
	const accounts = new InMemorySocialAccountRepository();
	for (const platform of platforms) {
		const account = SocialAccount.connect({
			id: `acc-${platform}`,
			platform,
			remoteId: `remote-${platform}`,
			displayName: platform,
			tokenExpiresAt: null,
			connectedAt: AGORA,
			connectedByStaffId: "admin-1",
		});
		accounts.accounts.set(platform, account);
		accounts.tokens.set(account.id, "token-secreto");
	}
	return accounts;
}

describe("forgetAllCredentials", () => {
	it("apaga o token das duas redes e as desliga", async () => {
		const accounts = repositorioCom("INSTAGRAM", "FACEBOOK");

		const esquecidas = await forgetAllCredentials({ accounts });

		expect(esquecidas).toEqual(["INSTAGRAM", "FACEBOOK"]);
		expect(accounts.tokens.size).toBe(0);
		expect(accounts.accounts.get("INSTAGRAM")?.status).toBe("DESCONECTADA");
		// O registro fica: o histórico do que foi publicado aponta para ele.
		expect(accounts.accounts.size).toBe(2);
	});

	it("diz só as redes que tinham conta", async () => {
		const accounts = repositorioCom("FACEBOOK");
		expect(await forgetAllCredentials({ accounts })).toEqual(["FACEBOOK"]);
	});

	it("sem conta nenhuma, não falha — o pedido da Meta pode chegar duas vezes", async () => {
		expect(
			await forgetAllCredentials({
				accounts: new InMemorySocialAccountRepository(),
			}),
		).toEqual([]);
	});
});
