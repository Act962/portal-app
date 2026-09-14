import { Forbidden } from "@portal-app/identity";
import { FixedClock } from "@portal-app/shared-kernel";
import {
	type DiagnoseDeps,
	diagnoseAccounts,
	SocialAccount,
	type SocialPlatform,
} from "@portal-app/social";
import { beforeEach, describe, expect, it } from "vitest";

import {
	FakeConnectionProbe,
	InMemorySocialAccountRepository,
	staff,
} from "./doubles";

const AGORA = new Date("2026-09-14T12:00:00Z");

let accounts: InMemorySocialAccountRepository;
let probe: FakeConnectionProbe;
let deps: DiagnoseDeps;

function conectar(
	platform: SocialPlatform,
	tokenExpiresAt: Date | null = null,
) {
	const account = SocialAccount.connect({
		id: `acc-${platform}`,
		platform,
		remoteId: `remote-${platform}`,
		displayName: platform,
		tokenExpiresAt,
		connectedAt: AGORA,
		connectedByStaffId: "admin-1",
	});
	accounts.accounts.set(platform, account);
	accounts.tokens.set(account.id, "token");
	return account;
}

async function diagnostico(platform: SocialPlatform) {
	const report = (await diagnoseAccounts(staff("EDITOR"), deps)).unwrap();
	const item = report.find((entry) => entry.platform === platform);
	if (!item) {
		throw new Error(`sem diagnóstico para ${platform}`);
	}
	return item;
}

beforeEach(() => {
	accounts = new InMemorySocialAccountRepository();
	probe = new FakeConnectionProbe();
	deps = {
		accounts,
		probe,
		clock: new FixedClock(AGORA),
		mediaSampleUrl: "https://pub.r2.dev/social/x.jpg",
	};
});

describe("diagnoseAccounts", () => {
	it("quem não aprova post não vê o diagnóstico", async () => {
		expect(await diagnoseAccounts(staff("REDATOR"), deps)).toBeErr(Forbidden);
	});

	it("responde pelas duas redes, sempre", async () => {
		const report = (await diagnoseAccounts(staff("ADMIN"), deps)).unwrap();
		expect(report.map((item) => item.platform)).toEqual([
			"INSTAGRAM",
			"FACEBOOK",
		]);
	});

	it("tudo certo: PRONTA, e a sonda foi consultada", async () => {
		conectar("FACEBOOK");
		const item = await diagnostico("FACEBOOK");
		expect(item).toEqual({
			platform: "FACEBOOK",
			verdict: "PRONTA",
			problems: [],
			warnings: [],
			quota: null,
		});
		expect(probe.inspected).toEqual(["FACEBOOK"]);
	});

	it("sem conta: BLOQUEADA, sem chamar a Meta", async () => {
		const item = await diagnostico("INSTAGRAM");
		expect(item.verdict).toBe("BLOQUEADA");
		expect(item.problems).toEqual([
			"Nenhuma conta do Instagram está conectada.",
		]);
		expect(probe.inspected).toHaveLength(0);
	});

	it("conta vencida: BLOQUEADA com o motivo, sem chamar a Meta", async () => {
		conectar("INSTAGRAM", new Date("2026-09-01T00:00:00Z"));
		const item = await diagnostico("INSTAGRAM");
		expect(item.problems[0]).toContain("venceu");
		expect(probe.inspected).toHaveLength(0);
	});

	it("autorização vencendo: ATENCAO, mas publica", async () => {
		conectar("INSTAGRAM", new Date("2026-09-17T00:00:00Z"));
		const item = await diagnostico("INSTAGRAM");
		expect(item.verdict).toBe("ATENCAO");
		expect(item.warnings[0]).toContain("vence em breve");
	});

	it("armazenamento em localhost bloqueia as duas redes, mesmo conectadas", async () => {
		// É o estado do ambiente de desenvolvimento: a conexão funciona e a
		// publicação morreria no download. O diagnóstico diz ANTES.
		conectar("INSTAGRAM");
		conectar("FACEBOOK");
		deps.mediaSampleUrl = "http://localhost:9000/portal-media/social/x.jpg";

		for (const platform of ["INSTAGRAM", "FACEBOOK"] as const) {
			const item = await diagnostico(platform);
			expect(item.verdict).toBe("BLOQUEADA");
			expect(item.problems[0]).toContain("endereço interno");
		}
	});

	it("App não configurado: avisa sem expor a configuração do servidor", async () => {
		conectar("FACEBOOK");
		deps.probe = null;
		const item = await diagnostico("FACEBOOK");
		expect(item.problems[0]).toContain("administrador do sistema");
		expect(item.problems[0]).not.toMatch(/META_|\.env|ambiente/);
	});

	it("conta sem credencial guardada pede reconexão", async () => {
		conectar("FACEBOOK");
		deps.accounts = Object.assign(
			Object.create(InMemorySocialAccountRepository.prototype),
			accounts,
			{ credentialsFor: async () => null },
		);
		const item = await diagnostico("FACEBOOK");
		expect(item.problems[0]).toContain("Reconecte");
	});

	it("repassa o que a Meta respondeu", async () => {
		conectar("FACEBOOK");
		probe.reply("FACEBOOK", { problems: ["Faltam permissões no login: x."] });
		const item = await diagnostico("FACEBOOK");
		expect(item.verdict).toBe("BLOQUEADA");
		expect(item.problems).toEqual(["Faltam permissões no login: x."]);
	});

	it("cota perto do fim: ATENCAO com os números", async () => {
		conectar("INSTAGRAM");
		probe.reply("INSTAGRAM", { quota: { used: 40, total: 50 } });
		const item = await diagnostico("INSTAGRAM");
		expect(item.verdict).toBe("ATENCAO");
		expect(item.warnings).toEqual([
			"40 de 50 publicações usadas nas últimas 24 horas.",
		]);
		expect(item.quota).toEqual({ used: 40, total: 50 });
	});

	it("cota esgotada: BLOQUEADA", async () => {
		conectar("INSTAGRAM");
		probe.reply("INSTAGRAM", { quota: { used: 50, total: 50 } });
		const item = await diagnostico("INSTAGRAM");
		expect(item.verdict).toBe("BLOQUEADA");
		expect(item.problems[0]).toContain("limite de 50");
	});

	it("cota com folga não gera aviso", async () => {
		conectar("INSTAGRAM");
		probe.reply("INSTAGRAM", { quota: { used: 3, total: 50 } });
		expect((await diagnostico("INSTAGRAM")).verdict).toBe("PRONTA");
	});
});
