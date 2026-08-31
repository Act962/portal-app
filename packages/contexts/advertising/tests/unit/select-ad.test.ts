import {
	Campaign,
	decideAd,
	eligibleCampaigns,
	pickWeighted,
} from "@portal-app/advertising";
import { describe, expect, it } from "vitest";

/**
 * A REGRA DE VEICULAÇÃO. É o teste mais importante deste contexto: cada decisão
 * aqui é dinheiro de alguém. Uma campanha que não aparece foi vendida e não
 * entregue; uma que aparece fora do período é espaço dado de graça.
 *
 * O sorteio entra por parâmetro (`roll`), então a proporção do rodízio é
 * PROVADA, e não estimada rodando mil vezes e torcendo.
 */

const NOW = new Date("2026-09-15T12:00:00Z");

function campaign(overrides: {
	id: string;
	slot?: string;
	weight?: number;
	sectionIds?: string[];
	startsAt?: Date;
	endsAt?: Date | null;
	status?: "ATIVA" | "PAUSADA" | "RASCUNHO";
	creative?: { mediaId: string; altText: string } | null;
}): Campaign {
	return Campaign.restore({
		id: overrides.id,
		name: `Campanha ${overrides.id}`,
		advertiser: "Anunciante",
		slot: (overrides.slot ?? "sidebar") as "sidebar",
		destinationUrl: "https://exemplo.com.br/",
		startsAt: overrides.startsAt ?? new Date("2026-09-01T00:00:00Z"),
		endsAt: overrides.endsAt === undefined ? null : overrides.endsAt,
		weight: overrides.weight ?? 1,
		sectionIds: overrides.sectionIds ?? [],
		creative:
			overrides.creative === undefined
				? { mediaId: "m-1", altText: "Anúncio" }
				: overrides.creative,
		status: overrides.status ?? "ATIVA",
		createdAt: new Date("2026-08-01T00:00:00Z"),
	});
}

const context = { slot: "sidebar" as const, sectionId: null, now: NOW };

describe("eligibleCampaigns", () => {
	it("descarta campanha de OUTRA posição", () => {
		const outra = campaign({ id: "a", slot: "billboard" });
		expect(eligibleCampaigns([outra], context)).toEqual([]);
	});

	it("descarta pausada e rascunho", () => {
		const pausada = campaign({ id: "a", status: "PAUSADA" });
		const rascunho = campaign({ id: "b", status: "RASCUNHO" });
		expect(eligibleCampaigns([pausada, rascunho], context)).toEqual([]);
	});

	it("descarta campanha sem imagem, mesmo ativa", () => {
		// O anúncio é a imagem: uma campanha "ativa" sem arte serviria um link
		// invisível, que ninguém clica e que conta impressão para o anunciante.
		const semArte = campaign({ id: "a", creative: null });
		expect(eligibleCampaigns([semArte], context)).toEqual([]);
	});

	it("descarta fora do período — antes de começar e depois de terminar", () => {
		const futura = campaign({
			id: "a",
			startsAt: new Date("2026-10-01T00:00:00Z"),
		});
		const vencida = campaign({
			id: "b",
			endsAt: new Date("2026-09-10T00:00:00Z"),
		});
		expect(eligibleCampaigns([futura, vencida], context)).toEqual([]);
	});

	it("campanha sem fim combinado continua no ar", () => {
		const semFim = campaign({ id: "a", endsAt: null });
		expect(eligibleCampaigns([semFim], context).map((c) => c.id)).toEqual([
			"a",
		]);
	});

	describe("prioridade da segmentação", () => {
		it("na editoria vendida, a segmentada EXCLUI a global", () => {
			// Quem comprou "só Esportes" comprou aquele espaço naquela editoria.
			// Deixá-la disputar no peso com uma global de peso 10 a faria aparecer
			// uma vez a cada onze — vendida, paga e invisível.
			const global = campaign({ id: "global", weight: 10 });
			const segmentada = campaign({
				id: "esportes",
				sectionIds: ["s-esportes"],
			});
			const eleitas = eligibleCampaigns([global, segmentada], {
				...context,
				sectionId: "s-esportes",
			});
			expect(eleitas.map((c) => c.id)).toEqual(["esportes"]);
		});

		it("fora da editoria vendida, a global volta a valer", () => {
			const global = campaign({ id: "global" });
			const segmentada = campaign({
				id: "esportes",
				sectionIds: ["s-esportes"],
			});
			const eleitas = eligibleCampaigns([global, segmentada], {
				...context,
				sectionId: "s-cidades",
			});
			expect(eleitas.map((c) => c.id)).toEqual(["global"]);
		});

		it("em página SEM editoria (home, busca), só a global vale", () => {
			const global = campaign({ id: "global" });
			const segmentada = campaign({
				id: "esportes",
				sectionIds: ["s-esportes"],
			});
			const eleitas = eligibleCampaigns([global, segmentada], {
				...context,
				sectionId: null,
			});
			expect(eleitas.map((c) => c.id)).toEqual(["global"]);
		});

		it("duas segmentadas na mesma editoria continuam disputando entre si", () => {
			const a = campaign({ id: "a", sectionIds: ["s-esportes"] });
			const b = campaign({ id: "b", sectionIds: ["s-esportes", "s-cidades"] });
			const eleitas = eligibleCampaigns([a, b], {
				...context,
				sectionId: "s-esportes",
			});
			expect(eleitas.map((c) => c.id)).toEqual(["a", "b"]);
		});
	});
});

describe("pickWeighted", () => {
	it("lista vazia não escolhe nada", () => {
		expect(pickWeighted([], 0.5)).toBeNull();
	});

	it("uma só campanha vence sempre, qualquer que seja o sorteio", () => {
		const unica = campaign({ id: "a" });
		for (const roll of [0, 0.25, 0.5, 0.99]) {
			expect(pickWeighted([unica], roll)?.id).toBe("a");
		}
	});

	it("pesos IGUAIS dividem a faixa ao meio", () => {
		const lista = [campaign({ id: "a" }), campaign({ id: "b" })];
		expect(pickWeighted(lista, 0)?.id).toBe("a");
		expect(pickWeighted(lista, 0.49)?.id).toBe("a");
		// A fronteira pertence à SEGUNDA: cada faixa é [início, fim), como o
		// período da campanha. Assim não existe um ponto que caia nas duas.
		expect(pickWeighted(lista, 0.5)?.id).toBe("b");
		expect(pickWeighted(lista, 0.999)?.id).toBe("b");
	});

	it("peso 3 contra 1 ocupa três quartos da faixa", () => {
		const lista = [
			campaign({ id: "grande", weight: 3 }),
			campaign({ id: "pequena" }),
		];
		expect(pickWeighted(lista, 0.74)?.id).toBe("grande");
		expect(pickWeighted(lista, 0.75)?.id).toBe("pequena");
	});

	it("a proporção se confirma varrendo a faixa inteira", () => {
		// Varredura determinística em vez de sorteio: 1000 pontos igualmente
		// espaçados em [0,1). Peso 3:1 tem de dar 750:250, exato.
		const lista = [
			campaign({ id: "grande", weight: 3 }),
			campaign({ id: "pequena" }),
		];
		const contagem = { grande: 0, pequena: 0 };
		for (let i = 0; i < 1000; i++) {
			const vencedora = pickWeighted(lista, i / 1000);
			contagem[vencedora?.id as "grande" | "pequena"] += 1;
		}
		expect(contagem).toEqual({ grande: 750, pequena: 250 });
	});

	it("sorteio fora da faixa não devolve nulo — prende no intervalo", () => {
		// `null` aqui seria lido pela tela como "não há anúncio", e o espaço
		// vendido ficaria vazio por causa de um erro de quem chamou.
		const lista = [campaign({ id: "a" }), campaign({ id: "b" })];
		expect(pickWeighted(lista, -1)?.id).toBe("a");
		expect(pickWeighted(lista, 2)?.id).toBe("b");
		expect(pickWeighted(lista, Number.NaN)?.id).toBe("a");
	});
});

describe("decideAd", () => {
	const base = { ...context, roll: 0.5, adsenseEnabled: true };

	it("campanha da casa ganha do AdSense", () => {
		// A ordem é comercial: venda direta paga muito mais que programático.
		const decisao = decideAd([campaign({ id: "a" })], base);
		expect(decisao.kind).toBe("campanha");
		expect(decisao.kind === "campanha" && decisao.campaign.id).toBe("a");
	});

	it("sem campanha, o AdSense preenche", () => {
		expect(decideAd([], base).kind).toBe("adsense");
	});

	it("sem campanha e sem AdSense, o espaço fica vazio", () => {
		expect(decideAd([], { ...base, adsenseEnabled: false }).kind).toBe("vazio");
	});

	it("campanha da posição ERRADA não impede o AdSense de preencher", () => {
		// O risco é a campanha de outra posição ser contada como "há algo aqui" e
		// bloquear o AdSense — deixando o espaço vazio e sem receita nenhuma.
		const outra = campaign({ id: "a", slot: "billboard" });
		expect(decideAd([outra], base).kind).toBe("adsense");
	});

	it("campanha vencida não impede o AdSense de preencher", () => {
		const vencida = campaign({
			id: "a",
			endsAt: new Date("2026-09-01T00:00:00Z"),
		});
		expect(decideAd([vencida], base).kind).toBe("adsense");
	});
});
