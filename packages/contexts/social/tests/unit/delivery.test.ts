import {
	AccountNotUsable,
	Delivery,
	SocialAccountNotFound,
	SocialPostNotFound,
	UnknownPlatform,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const AGORA = new Date("2026-09-11T12:00:00Z");

describe("Delivery", () => {
	it("nasce pendente, sem tentativa e sem id remoto", () => {
		const delivery = Delivery.pending("INSTAGRAM");
		expect(delivery.isPending()).toBe(true);
		expect(delivery.attempts).toBe(0);
		expect(delivery.remoteId).toBeNull();
		expect(delivery.lastAttemptAt).toBeNull();
	});

	it("publicar registra a prova, a tentativa e o horário", () => {
		const delivery = Delivery.pending("INSTAGRAM");
		delivery.markPublished("ig-1", "https://instagr.am/p/1", AGORA);
		expect(delivery.status).toBe("PUBLICADO");
		expect(delivery.remoteId).toBe("ig-1");
		expect(delivery.permalink).toBe("https://instagr.am/p/1");
		expect(delivery.attempts).toBe(1);
		expect(delivery.lastAttemptAt).toEqual(AGORA);
	});

	it("a entrega guarda a si mesma contra o reenvio, não só o agregado", () => {
		// A guarda vive nos DOIS níveis de propósito: o agregado protege o fluxo
		// normal, e esta protege quem chamar a entrega direto — que é o que um
		// adapter distraído faria.
		const delivery = Delivery.pending("INSTAGRAM");
		delivery.markPublished("ig-1", null, AGORA);
		delivery.markPublished("ig-2", "outro", AGORA);
		delivery.markFailed("erro tardio", AGORA);
		expect(delivery.remoteId).toBe("ig-1");
		expect(delivery.permalink).toBeNull();
		expect(delivery.error).toBeNull();
		expect(delivery.attempts).toBe(1);
	});

	it("falhar registra o motivo e conta a tentativa", () => {
		const delivery = Delivery.pending("FACEBOOK");
		delivery.markFailed("token expirado", AGORA);
		expect(delivery.status).toBe("FALHOU");
		expect(delivery.isFailed()).toBe(true);
		expect(delivery.error).toBe("token expirado");
		expect(delivery.attempts).toBe(1);
	});

	it("requeue só age sobre o que falhou", () => {
		const pendente = Delivery.pending("FACEBOOK");
		pendente.requeue();
		expect(pendente.isPending()).toBe(true);

		const publicada = Delivery.pending("FACEBOOK");
		publicada.markPublished("fb-1", null, AGORA);
		publicada.requeue();
		expect(publicada.isPublished()).toBe(true);
		expect(publicada.remoteId).toBe("fb-1");
	});

	it("requeue zera as tentativas e o erro — é um ciclo novo", () => {
		const delivery = Delivery.pending("FACEBOOK");
		delivery.markFailed("token expirado", AGORA);
		delivery.requeue();
		expect(delivery.isPending()).toBe(true);
		expect(delivery.attempts).toBe(0);
		expect(delivery.error).toBeNull();
	});

	it("falha passageira conta a tentativa e mostra o motivo, sem sair da fila", () => {
		const delivery = Delivery.pending("INSTAGRAM");
		delivery.markRetrying("instável", AGORA);
		expect(delivery.isPending()).toBe(true);
		expect(delivery.error).toBe("instável");
		expect(delivery.attempts).toBe(1);
		expect(delivery.lastAttemptAt).toEqual(AGORA);
	});

	it("falha passageira não mexe no que já está no ar", () => {
		const delivery = Delivery.pending("INSTAGRAM");
		delivery.markPublished("ig-1", null, AGORA);
		delivery.markRetrying("instável", AGORA);
		expect(delivery.isPublished()).toBe(true);
		expect(delivery.error).toBeNull();
		expect(delivery.attempts).toBe(1);
	});

	it("restore devolve a entrega do banco como ela estava", () => {
		const delivery = Delivery.restore({
			destination: "INSTAGRAM",
			status: "FALHOU",
			remoteId: null,
			permalink: null,
			error: "A imagem precisa ser JPEG.",
			attempts: 3,
			lastAttemptAt: AGORA,
		});
		expect(delivery.isFailed()).toBe(true);
		expect(delivery.attempts).toBe(3);
		expect(delivery.error).toBe("A imagem precisa ser JPEG.");
		expect(delivery.lastAttemptAt).toEqual(AGORA);
		expect(delivery.permalink).toBeNull();
	});
});

describe("mensagens de erro — elas aparecem na tela, então importam", () => {
	it("dizem o que aconteceu em português", () => {
		expect(new SocialPostNotFound("p-1").message).toContain("p-1");
		expect(new SocialAccountNotFound("Instagram").message).toContain(
			"Instagram",
		);
		expect(new UnknownPlatform("TWITTER").message).toContain("TWITTER");

		const conta = new AccountNotUsable("Instagram", "a autorização venceu");
		expect(conta.message).toContain("Instagram");
		expect(conta.message).toContain("a autorização venceu");
		expect(conta.platform).toBe("Instagram");
	});
});
