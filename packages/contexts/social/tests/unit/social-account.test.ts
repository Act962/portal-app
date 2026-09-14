import {
	isSocialPlatform,
	PLATFORM_LIMITS,
	SOCIAL_PLATFORMS,
	SocialAccount,
	TOKEN_WARNING_DAYS,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const CONECTADA_EM = new Date("2026-09-01T10:00:00Z");
const HOJE = new Date("2026-09-11T10:00:00Z");

function conta(tokenExpiresAt: Date | null) {
	return SocialAccount.connect({
		id: "acc-1",
		platform: "INSTAGRAM",
		remoteId: "17841405309211844",
		displayName: "@radio7cidades",
		tokenExpiresAt,
		connectedAt: CONECTADA_EM,
		connectedByStaffId: "staff-1",
	});
}

function emDias(days: number): Date {
	return new Date(HOJE.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("SocialAccount", () => {
	it("nasce conectada, guardando quem autorizou", () => {
		const account = conta(emDias(60));
		expect(account.status).toBe("CONECTADA");
		expect(account.connectedByStaffId).toBe("staff-1");
		expect(account.remoteId).toBe("17841405309211844");
		expect(account.displayName).toBe("@radio7cidades");
		expect(account.avatarUrl).toBeNull();
	});

	describe("stateAt — o vencimento é derivado do relógio, não guardado", () => {
		it("token sem validade é estado NORMAL: o da Página não expira", () => {
			expect(conta(null).stateAt(HOJE)).toBe("CONECTADA");
			expect(conta(null).isUsableAt(HOJE)).toBe(true);
		});

		it("com folga, CONECTADA", () => {
			expect(conta(emDias(30)).stateAt(HOJE)).toBe("CONECTADA");
		});

		it("dentro da janela de aviso, EXPIRANDO", () => {
			expect(conta(emDias(TOKEN_WARNING_DAYS - 1)).stateAt(HOJE)).toBe(
				"EXPIRANDO",
			);
		});

		it("EXPIRANDO ainda publica — calar uma semana antes seria pior", () => {
			const account = conta(emDias(2));
			expect(account.isUsableAt(HOJE)).toBe(true);
			expect(account.unusableReasonAt(HOJE)).toBeNull();
		});

		it("vencido, EXPIRADA, e o motivo já vem escrito para a tela", () => {
			const account = conta(emDias(-1));
			expect(account.stateAt(HOJE)).toBe("EXPIRADA");
			expect(account.isUsableAt(HOJE)).toBe(false);
			expect(account.unusableReasonAt(HOJE)).toContain("novo login");
		});

		it("no instante exato do vencimento já está EXPIRADA", () => {
			expect(conta(HOJE).stateAt(HOJE)).toBe("EXPIRADA");
		});
	});

	it("renovar depois de novo login devolve a conta ao ar", () => {
		const account = conta(emDias(-1));
		account.renew(emDias(60));
		expect(account.stateAt(HOJE)).toBe("CONECTADA");
	});

	it("desconectar não apaga o registro — o histórico aponta para ele", () => {
		// Apagar transformaria os posts já publicados numa lista de ids órfãos.
		const account = conta(null);
		account.disconnect();
		expect(account.stateAt(HOJE)).toBe("DESCONECTADA");
		expect(account.isUsableAt(HOJE)).toBe(false);
		expect(account.unusableReasonAt(HOJE)).toContain("desconectada");
		expect(account.remoteId).toBe("17841405309211844");
	});

	it("restore devolve a conta do banco com o estado que estava", () => {
		const account = SocialAccount.restore({
			id: "acc-2",
			platform: "FACEBOOK",
			remoteId: "134895793791914",
			displayName: "Rádio 7 Cidades",
			avatarUrl: "https://cdn/foto.jpg",
			tokenExpiresAt: null,
			status: "DESCONECTADA",
			connectedAt: CONECTADA_EM,
			connectedByStaffId: "staff-2",
		});
		expect(account.platform).toBe("FACEBOOK");
		expect(account.avatarUrl).toBe("https://cdn/foto.jpg");
		expect(account.status).toBe("DESCONECTADA");
		expect(account.connectedAt).toEqual(CONECTADA_EM);
		expect(account.tokenExpiresAt).toBeNull();
	});

	it("o token NÃO está no agregado — é o que impede vazá-lo em DTO ou log", () => {
		const serializado = JSON.stringify(conta(emDias(60)));
		expect(serializado).not.toContain("accessToken");
		expect(serializado.toLowerCase()).not.toContain('token":"ea');
	});
});

describe("plataformas", () => {
	it("reconhece as suportadas e recusa o resto", () => {
		expect(isSocialPlatform("INSTAGRAM")).toBe(true);
		expect(isSocialPlatform("FACEBOOK")).toBe(true);
		expect(isSocialPlatform("TWITTER")).toBe(false);
		expect(isSocialPlatform("")).toBe(false);
	});

	it("toda plataforma tem limites declarados", () => {
		for (const platform of SOCIAL_PLATFORMS) {
			expect(PLATFORM_LIMITS[platform].captionMaxLength).toBeGreaterThan(0);
			expect(PLATFORM_LIMITS[platform].mediaMaxCount).toBeGreaterThan(0);
		}
	});

	it("link na legenda do Instagram não é clicável — é o que muda o modelo padrão", () => {
		expect(PLATFORM_LIMITS.INSTAGRAM.captionLinksAreClickable).toBe(false);
		expect(PLATFORM_LIMITS.FACEBOOK.captionLinksAreClickable).toBe(true);
	});
});
