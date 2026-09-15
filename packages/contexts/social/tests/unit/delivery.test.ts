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

describe("Delivery — publicação manual (spec 11)", () => {
	it("os Stories nascem manuais; o feed, automático; pedir manual no feed não vale", () => {
		expect(Delivery.pending("INSTAGRAM_STORIES").mode).toBe("MANUAL");
		expect(Delivery.pending("INSTAGRAM").mode).toBe("AUTOMATICO");
		expect(Delivery.pending("FACEBOOK", "MANUAL").mode).toBe("AUTOMATICO");
		expect(Delivery.pending("INSTAGRAM_STORIES", "AUTOMATICO").mode).toBe(
			"AUTOMATICO",
		);
	});

	it("restaurar linha antiga, sem os campos novos, é automática", () => {
		const antiga = Delivery.restore({
			destination: "INSTAGRAM_STORIES",
			status: "PUBLICADO",
			remoteId: "story-1",
			permalink: null,
			error: null,
			attempts: 1,
			lastAttemptAt: AGORA,
		});
		expect(antiga.mode).toBe("AUTOMATICO");
		expect(antiga.preparedImageUrl).toBeNull();
		expect(antiga.publishedByStaffId).toBeNull();
	});

	it("preparar: só a manual pendente passa a esperar alguém, com a arte", () => {
		const story = Delivery.pending("INSTAGRAM_STORIES");
		story.markPrepared("https://cdn.test/arte.jpg", AGORA);
		expect(story.status).toBe("AGUARDANDO_PESSOA");
		expect(story.isAwaitingPerson()).toBe(true);
		expect(story.preparedImageUrl).toBe("https://cdn.test/arte.jpg");
		expect(story.attempts).toBe(1);

		// Preparar de novo não mexe.
		story.markPrepared("https://cdn.test/outra.jpg", AGORA);
		expect(story.preparedImageUrl).toBe("https://cdn.test/arte.jpg");

		const feed = Delivery.pending("INSTAGRAM");
		feed.markPrepared("https://cdn.test/arte.jpg", AGORA);
		expect(feed.isPending()).toBe(true);
	});

	it("'Já publiquei' só vale para o que espera alguém, e uma vez", () => {
		const story = Delivery.pending("INSTAGRAM_STORIES");
		expect(story.markPublishedByPerson("editor-1", null, AGORA)).toBe(false);

		story.markPrepared("https://cdn.test/arte.jpg", AGORA);
		expect(
			story.markPublishedByPerson("editor-1", "https://instagr.am/s/1", AGORA),
		).toBe(true);
		expect(story.status).toBe("PUBLICADO");
		expect(story.publishedByStaffId).toBe("editor-1");
		expect(story.permalink).toBe("https://instagr.am/s/1");
		expect(story.remoteId).toBeNull();

		expect(story.markPublishedByPerson("editor-2", null, AGORA)).toBe(false);
		expect(story.publishedByStaffId).toBe("editor-1");
	});

	it("dispensa o que espera alguém ou falhou; não o que está a caminho ou no ar", () => {
		const esperando = Delivery.pending("INSTAGRAM_STORIES");
		esperando.markPrepared("u", AGORA);
		expect(esperando.dismiss()).toBe(true);
		expect(esperando.isDismissed()).toBe(true);

		const falhou = Delivery.pending("INSTAGRAM");
		falhou.markFailed("recusou", AGORA);
		expect(falhou.dismiss()).toBe(true);

		expect(Delivery.pending("INSTAGRAM").dismiss()).toBe(false);
		const noAr = Delivery.pending("INSTAGRAM");
		noAr.markPublished("ig", null, AGORA);
		expect(noAr.dismiss()).toBe(false);
	});

	it("publicar à mão: só a automática que falhou, num destino que aceita", () => {
		const story = Delivery.pending("INSTAGRAM_STORIES", "AUTOMATICO");
		expect(story.switchToManual()).toBe(false);

		story.markFailed("recusou", AGORA);
		expect(story.switchToManual()).toBe(true);
		expect(story).toMatchObject({
			mode: "MANUAL",
			status: "PENDENTE",
			error: null,
			attempts: 0,
		});
		expect(story.switchToManual()).toBe(false);

		const feed = Delivery.pending("INSTAGRAM");
		feed.markFailed("recusou", AGORA);
		expect(feed.switchToManual()).toBe(false);
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
