import {
	AdSenseSettings,
	Campaign,
	Destination,
	Flight,
	MAX_WEIGHT,
} from "@portal-app/advertising";
import { describe, expect, it } from "vitest";

const CREATED = new Date("2026-08-01T00:00:00Z");

const base = {
	id: "c-1",
	name: "Verão 2026",
	advertiser: "Loja do Zé",
	slot: "sidebar",
	destinationUrl: "https://lojadoze.com.br/promo",
	startsAt: new Date("2026-09-01T00:00:00Z"),
	endsAt: new Date("2026-10-01T00:00:00Z"),
	createdAt: CREATED,
};

describe("Destination", () => {
	it("aceita https e http", () => {
		expect(Destination.create("https://x.com.br").isOk()).toBe(true);
		expect(Destination.create("http://x.com.br").isOk()).toBe(true);
	});

	it("RECUSA javascript: — é execução de código na nossa origem", () => {
		// O caminho real: a equipe comercial cola o que o anunciante mandou. Uma
		// lista de PERMITIDOS fecha isso; uma de proibidos deixaria passar o
		// esquema que ninguém lembrou de proibir.
		const erro = Destination.create("javascript:alert(1)").unwrapErr();
		expect(erro.name).toBe("InvalidDestination");
	});

	it("recusa data: pelo mesmo motivo", () => {
		expect(Destination.create("data:text/html,<script>").isErr()).toBe(true);
	});

	it("recusa link sem esquema, dizendo qual é o erro real", () => {
		// Esquecer o https:// é O erro de quem cola link. A mensagem diz isso em
		// vez de "inválido", que não ajuda ninguém a consertar.
		const erro = Destination.create("lojadoze.com.br").unwrapErr();
		expect(erro.message).toContain("https://");
	});

	it("recusa vazio e só-espaços", () => {
		expect(Destination.create("").isErr()).toBe(true);
		expect(Destination.create("   ").isErr()).toBe(true);
	});

	it("expõe o host para a tela não mostrar uma URL de rastreamento inteira", () => {
		const destino = Destination.create(
			"https://lojadoze.com.br/promo?utm_source=portal&utm_campaign=verao2026&gclid=abc123",
		).unwrap();
		expect(destino.host).toBe("lojadoze.com.br");
	});
});

describe("Flight", () => {
	it("aceita período sem fim — contrato 'até segunda ordem'", () => {
		expect(Flight.create(base.startsAt, null).isOk()).toBe(true);
	});

	it("recusa fim antes do início", () => {
		expect(Flight.create(base.endsAt as Date, base.startsAt).isErr()).toBe(
			true,
		);
	});

	it("recusa duração ZERO — seria um contrato que nunca pode ser cumprido", () => {
		expect(Flight.create(base.startsAt, base.startsAt).isErr()).toBe(true);
	});

	it("recusa data inválida", () => {
		expect(Flight.create(new Date("nada"), null).isErr()).toBe(true);
	});

	describe("containsAt — início inclusivo, fim exclusivo", () => {
		const flight = Flight.create(
			new Date("2026-09-01T00:00:00Z"),
			new Date("2026-10-01T00:00:00Z"),
		).unwrap();

		it("o instante exato do início JÁ conta", () => {
			expect(flight.containsAt(new Date("2026-09-01T00:00:00Z"))).toBe(true);
		});

		it("o instante exato do fim JÁ NÃO conta", () => {
			// É o que faz períodos consecutivos se encaixarem: a campanha seguinte
			// começa nesse mesmo instante, e não existe um segundo em que as duas
			// valem nem um em que nenhuma vale.
			expect(flight.containsAt(new Date("2026-10-01T00:00:00Z"))).toBe(false);
		});

		it("um milissegundo antes do fim ainda conta", () => {
			expect(flight.containsAt(new Date("2026-09-30T23:59:59.999Z"))).toBe(
				true,
			);
		});
	});
});

describe("Campaign.create", () => {
	it("nasce RASCUNHO — nada vai ao ar por acidente", () => {
		const campanha = Campaign.create(base).unwrap();
		expect(campanha.status).toBe("RASCUNHO");
	});

	it("apara espaços do nome e do anunciante", () => {
		const campanha = Campaign.create({
			...base,
			name: "  Verão  ",
			advertiser: "  Loja  ",
		}).unwrap();
		expect(campanha.name).toBe("Verão");
		expect(campanha.advertiser).toBe("Loja");
	});

	it("recusa nome e anunciante vazios", () => {
		expect(Campaign.create({ ...base, name: "   " }).unwrapErr().name).toBe(
			"CampaignNameRequired",
		);
		expect(Campaign.create({ ...base, advertiser: "" }).unwrapErr().name).toBe(
			"AdvertiserRequired",
		);
	});

	it("recusa posição desconhecida", () => {
		// A posição vem como string da API; um valor fora da lista produziria uma
		// campanha que nunca aparece, sem erro nenhum.
		expect(Campaign.create({ ...base, slot: "rodape" }).unwrapErr().name).toBe(
			"InvalidSlot",
		);
	});

	it("recusa peso fora da faixa e peso quebrado", () => {
		for (const weight of [0, -1, MAX_WEIGHT + 1, 1.5]) {
			expect(Campaign.create({ ...base, weight }).unwrapErr().name).toBe(
				"InvalidWeight",
			);
		}
	});

	it("sem editorias, a campanha é global", () => {
		expect(Campaign.create(base).unwrap().isGlobal).toBe(true);
	});
});

describe("ativação", () => {
	it("campanha sem imagem NÃO sobe, e diz o motivo", () => {
		const campanha = Campaign.create(base).unwrap();
		const erro = campanha.activate().unwrapErr();
		expect(erro.name).toBe("CampaignNotReady");
		expect(erro.blockers[0]).toContain("imagem");
		expect(campanha.status).toBe("RASCUNHO");
	});

	it("imagem sem texto alternativo também barra", () => {
		// Anúncio sem alt é imagem muda para quem usa leitor de tela, e a lei de
		// acessibilidade não abre exceção para publicidade.
		const campanha = Campaign.create({
			...base,
			creative: { mediaId: "m-1", altText: "  " },
		}).unwrap();
		expect(campanha.activate().unwrapErr().blockers[0]).toContain(
			"texto alternativo",
		);
	});

	it("com imagem e alt, sobe", () => {
		const campanha = Campaign.create({
			...base,
			creative: { mediaId: "m-1", altText: "Promoção de verão" },
		}).unwrap();
		expect(campanha.activate().isOk()).toBe(true);
		expect(campanha.status).toBe("ATIVA");
	});

	it("pausar NÃO encurta o período", () => {
		// Encurtar devolveria dias que o anunciante comprou.
		const campanha = Campaign.create({
			...base,
			creative: { mediaId: "m-1", altText: "x" },
		}).unwrap();
		campanha.activate();
		campanha.pause();
		expect(campanha.status).toBe("PAUSADA");
		expect(campanha.flight.endsAt).toEqual(base.endsAt);
	});
});

describe("stateAt — os estados derivados do relógio", () => {
	function ativa(overrides: Partial<typeof base> = {}) {
		const campanha = Campaign.create({
			...base,
			...overrides,
			creative: { mediaId: "m-1", altText: "x" },
		}).unwrap();
		campanha.activate();
		return campanha;
	}

	it("antes do início: AGENDADA", () => {
		expect(ativa().stateAt(new Date("2026-08-15T00:00:00Z"))).toBe("AGENDADA");
	});

	it("dentro do período: NO_AR", () => {
		expect(ativa().stateAt(new Date("2026-09-15T00:00:00Z"))).toBe("NO_AR");
	});

	it("depois do fim: ENCERRADA, sem ninguém mexer no status", () => {
		// Derivado de propósito: um status gravado exigiria um job varrendo
		// campanhas vencidas, e no dia em que ele falhasse o anúncio continuaria
		// no ar depois do fim do contrato.
		expect(ativa().stateAt(new Date("2026-11-01T00:00:00Z"))).toBe("ENCERRADA");
	});

	it("pausada continua PAUSADA mesmo dentro do período", () => {
		const campanha = ativa();
		campanha.pause();
		expect(campanha.stateAt(new Date("2026-09-15T00:00:00Z"))).toBe("PAUSADA");
	});
});

describe("servesSection", () => {
	function comEditorias(sectionIds: string[]) {
		return Campaign.create({ ...base, sectionIds }).unwrap();
	}

	it("global serve qualquer página, inclusive as sem editoria", () => {
		const global = comEditorias([]);
		expect(global.servesSection("s-1")).toBe(true);
		expect(global.servesSection(null)).toBe(true);
	});

	it("segmentada serve só as suas", () => {
		const segmentada = comEditorias(["s-1", "s-2"]);
		expect(segmentada.servesSection("s-1")).toBe(true);
		expect(segmentada.servesSection("s-3")).toBe(false);
	});

	it("segmentada NÃO serve página sem editoria", () => {
		// Home e busca não pertencem a editoria nenhuma; servir ali seria entregar
		// fora do que foi vendido.
		expect(comEditorias(["s-1"]).servesSection(null)).toBe(false);
	});
});

describe("AdSenseSettings", () => {
	it("padrão é DESLIGADO e não personalizado", () => {
		// Ligado por padrão colocaria script do Google no ar sem ninguém pedir.
		const settings = AdSenseSettings.restore(null);
		expect(settings.data.enabled).toBe(false);
		expect(settings.data.nonPersonalized).toBe(true);
	});

	it("recusa publisher id fora do formato do Google", () => {
		const atual = AdSenseSettings.restore(null).data;
		for (const id of ["pub-123", "ca-pub-", "ca-pub-abc", "12345"]) {
			expect(
				AdSenseSettings.change({ publisherId: id }, atual).unwrapErr().name,
			).toBe("InvalidPublisherId");
		}
	});

	it("aceita o formato correto e trata vazio como 'não configurado'", () => {
		const atual = AdSenseSettings.restore(null).data;
		expect(
			AdSenseSettings.change(
				{ publisherId: "ca-pub-1234567890123456" },
				atual,
			).unwrap().data.publisherId,
		).toBe("ca-pub-1234567890123456");
		expect(
			AdSenseSettings.change({ publisherId: "  " }, atual).unwrap().data
				.publisherId,
		).toBeNull();
	});

	it("descarta id de unidade vazio em vez de guardar string vazia", () => {
		// Guardar "" faria o portal montar uma tag sem unidade — caixa vazia na
		// página e requisição contada como inválida no relatório do Google.
		const atual = AdSenseSettings.restore(null).data;
		const settings = AdSenseSettings.change(
			{ slotIds: { sidebar: "  ", billboard: "123" } },
			atual,
		).unwrap();
		expect(settings.data.slotIds).toEqual({ billboard: "123" });
	});

	describe("servesSlot exige as TRÊS condições", () => {
		const completo = {
			publisherId: "ca-pub-1234567890123456",
			enabled: true,
			slotIds: { sidebar: "999" },
			nonPersonalized: true,
		};

		it("com tudo configurado, serve", () => {
			expect(AdSenseSettings.restore(completo).servesSlot("sidebar")).toBe(
				true,
			);
		});

		it("chave geral desligada bloqueia tudo", () => {
			expect(
				AdSenseSettings.restore({ ...completo, enabled: false }).servesSlot(
					"sidebar",
				),
			).toBe(false);
		});

		it("sem publisher id, não serve", () => {
			expect(
				AdSenseSettings.restore({ ...completo, publisherId: null }).servesSlot(
					"sidebar",
				),
			).toBe(false);
		});

		it("posição sem unidade cadastrada não serve", () => {
			// Melhor espaço vazio do que uma caixa quebrada do Google.
			expect(AdSenseSettings.restore(completo).servesSlot("billboard")).toBe(
				false,
			);
		});
	});

	it("monta a linha do ads.txt, e nada sem publisher id", () => {
		// Sem ads.txt no ar, o Google trata o inventário como não autorizado e a
		// receita despenca — é exigência da IAB, não recomendação.
		expect(
			AdSenseSettings.restore({
				publisherId: "ca-pub-1234567890123456",
			}).adsTxtLine(),
		).toBe("google.com, ca-pub-1234567890123456, DIRECT, f08c47fec0942fa0");
		expect(AdSenseSettings.restore(null).adsTxtLine()).toBeNull();
	});
});
