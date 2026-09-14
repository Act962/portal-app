import { describe, expect, it } from "vitest";

import {
	accountTone,
	availableActions,
	captionCounters,
	DIAGNOSIS_LABELS,
	diagnosisTone,
	metaFlagMessage,
	POST_STATUS_LABELS,
	permalinkLabel,
	previewCaption,
	quotaSummary,
	storyNotice,
	summarizeDeliveries,
} from "@/app/(app)/dashboard/social/social-labels";

describe("Stories do Instagram (§17)", () => {
	it("não ganham contador de legenda — ela não é publicada lá", () => {
		expect(captionCounters("oi", ["INSTAGRAM_STORIES"])).toEqual([]);
		expect(
			captionCounters("oi", ["INSTAGRAM", "INSTAGRAM_STORIES"]).map(
				(counter) => counter.destination,
			),
		).toEqual(["INSTAGRAM"]);
	});

	it("o resumo das entregas nomeia o destino", () => {
		expect(
			summarizeDeliveries([
				{ destination: "INSTAGRAM", status: "PUBLICADO" },
				{ destination: "INSTAGRAM_STORIES", status: "PENDENTE" },
			]),
		).toBe("Instagram no ar · Stories do Instagram na fila");
	});

	it("o botão do link diz para onde vai, sem português torto", () => {
		expect(permalinkLabel("INSTAGRAM")).toBe("Ver no Instagram");
		expect(permalinkLabel("FACEBOOK")).toBe("Ver no Facebook");
		expect(permalinkLabel("INSTAGRAM_STORIES")).toBe("Ver o story (24 h)");
	});

	it("o aviso do editor só aparece com Stories escolhidos", () => {
		expect(storyNotice(["INSTAGRAM", "FACEBOOK"], 3)).toBeNull();
		expect(storyNotice(["INSTAGRAM_STORIES"], 1)).toContain("1080×1920");
		expect(storyNotice(["INSTAGRAM_STORIES"], 1)).not.toContain("Das ");
	});

	it("com carrossel, avisa que só a primeira imagem vai para o story", () => {
		expect(storyNotice(["INSTAGRAM", "INSTAGRAM_STORIES"], 3)).toContain(
			"Das 3 imagens, vai só a primeira.",
		);
	});
});

describe("availableActions", () => {
	it("o rascunho oferece aprovar, editar e descartar", () => {
		expect(availableActions("RASCUNHO")).toEqual([
			"aprovar",
			"editar",
			"descartar",
		]);
	});

	it("enquanto ENVIA não oferece nada — inclusive não oferece cancelar", () => {
		// Um "cancelar" aqui mentiria: a chamada à Meta já pode ter saído, e ela
		// não desfaz publicação por nós.
		expect(availableActions("PUBLICANDO")).toEqual([]);
	});

	it("falha e falha parcial oferecem tentar de novo", () => {
		expect(availableActions("FALHOU")).toEqual(["tentar-de-novo"]);
		expect(availableActions("PARCIAL")).toEqual(["tentar-de-novo"]);
	});

	it("o que já está no ar não oferece aprovar de novo", () => {
		// Oferecer levaria ao segundo post que o agregado recusa: o erro viraria
		// mensagem vermelha em vez de nunca ter sido oferecido.
		expect(availableActions("PUBLICADO")).not.toContain("aprovar");
		expect(availableActions("CANCELADA")).toEqual([]);
	});
});

describe("captionCounters", () => {
	it("conta emoji como um caractere, igual ao servidor", () => {
		// Se a tela contasse por `.length`, diria que não cabe uma legenda que o
		// servidor aceita — e o emoji é onde os dois números divergem.
		const [instagram] = captionCounters("Chuva 🎉", ["INSTAGRAM"]);
		expect(instagram?.length).toBe(7);
	});

	it("marca o estouro da rede certa, e só dela", () => {
		const [instagram, facebook] = captionCounters("a".repeat(2201), [
			"INSTAGRAM",
			"FACEBOOK",
		]);
		expect(instagram?.over).toBe(true);
		expect(instagram?.max).toBe(2200);
		expect(facebook?.over).toBe(false);
	});

	it("conta hashtags e marca o teto do Instagram", () => {
		const texto = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
		const [instagram] = captionCounters(texto, ["INSTAGRAM"]);
		expect(instagram?.hashtags).toBe(31);
		expect(instagram?.hashtagsOver).toBe(true);
	});

	it("sem rede escolhida, não há contador", () => {
		expect(captionCounters("oi", [])).toEqual([]);
	});
});

describe("summarizeDeliveries", () => {
	it("resume onde o post está, em uma linha", () => {
		expect(
			summarizeDeliveries([
				{ destination: "INSTAGRAM", status: "PUBLICADO" },
				{ destination: "FACEBOOK", status: "FALHOU" },
			]),
		).toBe("Instagram no ar · Facebook falhou");
	});

	it("diz que falta escolher rede em vez de devolver vazio", () => {
		expect(summarizeDeliveries([])).toBe("Nenhuma rede escolhida");
	});
});

describe("previewCaption", () => {
	it("achata quebras de linha — o cartão é de uma linha só", () => {
		expect(previewCaption("Título\n\nLinha-fina")).toBe("Título Linha-fina");
	});

	it("corta no espaço, sem partir palavra ao meio", () => {
		const texto = `${"palavra ".repeat(40)}final`;
		const corte = previewCaption(texto, 50);
		expect(corte.endsWith("…")).toBe(true);
		expect(corte.length).toBeLessThanOrEqual(51);
		expect(corte).not.toContain("palav…");
	});

	it("texto curto passa inteiro, sem reticências", () => {
		expect(previewCaption("Chuva no centro")).toBe("Chuva no centro");
	});

	it("palavra única gigante é cortada mesmo assim", () => {
		// Sem o piso de 60%, uma URL enorme sem espaço voltaria inteira.
		const corte = previewCaption("a".repeat(300), 20);
		expect(corte).toBe(`${"a".repeat(20)}…`);
	});
});

describe("rótulos e tons", () => {
	it("PARCIAL vira uma frase que a redação entende", () => {
		expect(POST_STATUS_LABELS.PARCIAL).toBe("Publicado em parte");
		expect(POST_STATUS_LABELS.RASCUNHO).toBe("Aguardando aprovação");
	});

	it("conta vencendo é ATENÇÃO, não erro — ela ainda publica", () => {
		expect(accountTone("CONECTADA")).toBe("ok");
		expect(accountTone("EXPIRANDO")).toBe("atencao");
		expect(accountTone("EXPIRADA")).toBe("erro");
		expect(accountTone("DESCONECTADA")).toBe("erro");
	});
});

describe("metaFlagMessage — a volta do login da Meta", () => {
	it("cancelamento é informativo, não erro", () => {
		expect(metaFlagMessage("cancelado")?.tone).toBe("info");
	});

	it("falha e falta de configuração são erro, com o que conferir", () => {
		expect(metaFlagMessage("erro")).toMatchObject({ tone: "erro" });
		expect(metaFlagMessage("erro")?.message).toContain("endereço de retorno");
		expect(metaFlagMessage("nao-configurado")?.message).toContain(
			"META_APP_ID",
		);
	});

	it("o caminho feliz não gera aviso — a escolha de Página já aparece", () => {
		expect(metaFlagMessage("escolher")).toBeNull();
	});

	it("parâmetro inventado na URL não vira aviso vermelho", () => {
		expect(metaFlagMessage("qualquer-coisa")).toBeNull();
		expect(metaFlagMessage(null)).toBeNull();
	});
});

describe("diagnóstico — Verificar conexão", () => {
	it("cada veredito tem rótulo e tom", () => {
		expect(DIAGNOSIS_LABELS.BLOQUEADA).toBe("Não publica");
		expect(diagnosisTone("PRONTA")).toBe("ok");
		expect(diagnosisTone("ATENCAO")).toBe("atencao");
		expect(diagnosisTone("BLOQUEADA")).toBe("erro");
	});

	it("a cota diz quantas ainda cabem hoje", () => {
		expect(quotaSummary({ used: 12, total: 50 })).toBe(
			"12 de 50 publicações nas últimas 24 h · restam 38",
		);
	});

	it("singular quando resta uma", () => {
		expect(quotaSummary({ used: 49, total: 50 })).toContain("resta 1");
	});

	it("cota estourada não mostra número negativo", () => {
		expect(quotaSummary({ used: 52, total: 50 })).toContain("restam 0");
	});
});
