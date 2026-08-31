import {
	AdSenseSettings,
	type AdSenseSettingsRepository,
	activateCampaign,
	campaignStats,
	candidatesForSlot,
	changeAdSenseSettings,
	createCampaign,
	decideAdForSlot,
	deleteCampaign,
	InMemoryAdStatsCounter,
	InMemoryCampaignRepository,
	listCampaigns,
	pauseCampaign,
	recordAdEvent,
	updateCampaign,
} from "@portal-app/advertising";
import { Forbidden, StaffMember } from "@portal-app/identity";
import { FixedClock, SequentialIdGenerator } from "@portal-app/shared-kernel";
import { beforeEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-09-15T12:00:00Z");
const CLOCK = new FixedClock(NOW);

/** Fake da configuração do AdSense — o mesmo contrato do adapter Prisma. */
class InMemoryAdSenseSettings implements AdSenseSettingsRepository {
	private settings = AdSenseSettings.restore(null);
	load() {
		return Promise.resolve(this.settings);
	}
	save(next: AdSenseSettings) {
		this.settings = next;
		return Promise.resolve();
	}
}

let repo: InMemoryCampaignRepository;
let stats: InMemoryAdStatsCounter;
let settings: InMemoryAdSenseSettings;
let deps: {
	repo: InMemoryCampaignRepository;
	stats: InMemoryAdStatsCounter;
	settings: InMemoryAdSenseSettings;
	clock: FixedClock;
	ids: SequentialIdGenerator;
};

beforeEach(() => {
	repo = new InMemoryCampaignRepository();
	stats = new InMemoryAdStatsCounter();
	settings = new InMemoryAdSenseSettings();
	deps = {
		repo,
		stats,
		settings,
		clock: CLOCK,
		ids: new SequentialIdGenerator("camp"),
	};
});

function staff(role: "ADMIN" | "EDITOR" | "REDATOR", id = role.toLowerCase()) {
	return StaffMember.restore({
		id,
		email: `${id}@x.com`,
		role,
		status: "ATIVO",
		sectionIds: ["s-esportes"],
	});
}

const ADMIN = () => staff("ADMIN");

const input = {
	name: "Verão 2026",
	advertiser: "Loja do Zé",
	slot: "sidebar",
	destinationUrl: "https://lojadoze.com.br",
	startsAt: new Date("2026-09-01T00:00:00Z"),
	endsAt: new Date("2026-10-01T00:00:00Z"),
	creative: { mediaId: "m-1", altText: "Promoção" },
};

async function campanhaNoAr(overrides: Partial<typeof input> = {}) {
	const campanha = (
		await createCampaign(ADMIN(), { ...input, ...overrides }, deps)
	).unwrap();
	await activateCampaign(ADMIN(), { id: campanha.id }, deps);
	return campanha;
}

describe("autorização — publicidade é receita, não redação", () => {
	it("EDITOR não cria, não edita, não ativa e não apaga", () => {
		// A permissão `ads:manage` não está na matriz de EDITOR nem de REDATOR.
		// Um editor subir anúncio por engano é o risco que isto fecha.
		const editor = staff("EDITOR");
		return Promise.all([
			createCampaign(editor, input, deps),
			updateCampaign(editor, { id: "x", name: "y" }, deps),
			activateCampaign(editor, { id: "x" }, deps),
			pauseCampaign(editor, { id: "x" }, deps),
			deleteCampaign(editor, { id: "x" }, deps),
		]).then((results) => {
			for (const result of results) {
				expect(result.unwrapErr()).toBeInstanceOf(Forbidden);
			}
		});
	});

	it("REDATOR também não", async () => {
		expect(
			(await createCampaign(staff("REDATOR"), input, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("ADMIN inativo não passa", async () => {
		const inativo = StaffMember.restore({
			id: "x",
			email: "x@x.com",
			role: "ADMIN",
			status: "INATIVO",
			sectionIds: [],
		});
		expect(
			(await createCampaign(inativo, input, deps)).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("ADMIN cria", async () => {
		expect((await createCampaign(ADMIN(), input, deps)).isOk()).toBe(true);
	});

	it("relatório de desempenho também é restrito", async () => {
		expect(
			(
				await campaignStats(
					staff("EDITOR"),
					{ campaignIds: [], from: NOW, to: NOW },
					deps,
				)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});

	it("mexer no AdSense é restrito", async () => {
		expect(
			(
				await changeAdSenseSettings(staff("EDITOR"), { enabled: true }, deps)
			).unwrapErr(),
		).toBeInstanceOf(Forbidden);
	});
});

describe("ciclo de vida", () => {
	it("id inexistente devolve CampaignNotFound", async () => {
		for (const result of [
			await updateCampaign(ADMIN(), { id: "nao-existe" }, deps),
			await activateCampaign(ADMIN(), { id: "nao-existe" }, deps),
			await pauseCampaign(ADMIN(), { id: "nao-existe" }, deps),
			await deleteCampaign(ADMIN(), { id: "nao-existe" }, deps),
		]) {
			expect(result.unwrapErr().name).toBe("CampaignNotFound");
		}
	});

	it("editar link inválido NÃO grava nada", async () => {
		const campanha = await campanhaNoAr();
		const erro = await updateCampaign(
			ADMIN(),
			{ id: campanha.id, destinationUrl: "javascript:alert(1)" },
			deps,
		);
		expect(erro.isErr()).toBe(true);
		const salva = await repo.findById(campanha.id);
		expect(salva?.destination.value).toBe("https://lojadoze.com.br/");
	});

	it("apagar remove de verdade", async () => {
		const campanha = await campanhaNoAr();
		await deleteCampaign(ADMIN(), { id: campanha.id }, deps);
		expect(await repo.findById(campanha.id)).toBeNull();
	});
});

describe("veiculação", () => {
	it("serve a campanha no ar", async () => {
		await campanhaNoAr();
		const decisao = await decideAdForSlot(
			{ slot: "sidebar", sectionId: null, roll: 0 },
			deps,
		);
		expect(decisao.kind).toBe("campanha");
	});

	it("campanha em RASCUNHO não vai ao ar", async () => {
		await createCampaign(ADMIN(), input, deps);
		const decisao = await decideAdForSlot(
			{ slot: "sidebar", sectionId: null, roll: 0 },
			deps,
		);
		expect(decisao.kind).toBe("vazio");
	});

	it("sem campanha e com AdSense configurado, o AdSense preenche", async () => {
		await changeAdSenseSettings(
			ADMIN(),
			{
				enabled: true,
				publisherId: "ca-pub-1234567890123456",
				slotIds: { sidebar: "999" },
			},
			deps,
		);
		const decisao = await decideAdForSlot(
			{ slot: "sidebar", sectionId: null, roll: 0 },
			deps,
		);
		expect(decisao.kind).toBe("adsense");
	});

	it("candidatesForSlot devolve a lista para o CLIENTE sortear", async () => {
		// Existe por causa do cache: sorteio no servidor ficaria congelado junto
		// com o HTML e todo mundo veria a mesma campanha por um minuto.
		await campanhaNoAr({ name: "A" });
		await campanhaNoAr({ name: "B" });
		const { campaigns } = await candidatesForSlot(
			{ slot: "sidebar", sectionId: null },
			deps,
		);
		expect(campaigns).toHaveLength(2);
	});

	it("a lista já vem com a prioridade de segmentação aplicada", async () => {
		await campanhaNoAr({ name: "Global" });
		await campanhaNoAr({ name: "Esportes", sectionIds: ["s-esportes"] });
		const { campaigns } = await candidatesForSlot(
			{ slot: "sidebar", sectionId: "s-esportes" },
			deps,
		);
		expect(campaigns.map((c) => c.name)).toEqual(["Esportes"]);
	});
});

describe("impressões e cliques", () => {
	it("conta impressão e clique separadamente", async () => {
		const campanha = await campanhaNoAr();
		await recordAdEvent({ campaignId: campanha.id, type: "impression" }, deps);
		await recordAdEvent({ campaignId: campanha.id, type: "impression" }, deps);
		await recordAdEvent({ campaignId: campanha.id, type: "click" }, deps);

		const [total] = (
			await campaignStats(
				ADMIN(),
				{
					campaignIds: [campanha.id],
					from: new Date("2026-09-01T00:00:00Z"),
					to: new Date("2026-10-01T00:00:00Z"),
				},
				deps,
			)
		).unwrap();
		expect(total).toEqual({
			campaignId: campanha.id,
			impressions: 2,
			clicks: 1,
		});
	});

	it("id inventado NÃO cria estatística", async () => {
		// Sem esta checagem, qualquer id na rota pública encheria o relatório de
		// linhas que ninguém consegue mais associar a nada.
		const result = await recordAdEvent(
			{ campaignId: "inventado", type: "click" },
			deps,
		);
		expect(result.unwrapErr().name).toBe("CampaignNotFound");
	});

	it("campanha sem eventos volta com ZERO, e não ausente", async () => {
		// A tela precisa mostrar "0 cliques", que é informação. A linha faltando
		// pareceria erro de carregamento.
		const campanha = await campanhaNoAr();
		const [total] = (
			await campaignStats(
				ADMIN(),
				{ campaignIds: [campanha.id], from: NOW, to: new Date("2026-10-01") },
				deps,
			)
		).unwrap();
		expect(total).toEqual({
			campaignId: campanha.id,
			impressions: 0,
			clicks: 0,
		});
	});

	it("evento fora do período pedido não entra na conta", async () => {
		const campanha = await campanhaNoAr();
		await recordAdEvent({ campaignId: campanha.id, type: "click" }, deps);
		const [total] = (
			await campaignStats(
				ADMIN(),
				{
					campaignIds: [campanha.id],
					from: new Date("2026-08-01T00:00:00Z"),
					to: new Date("2026-09-01T00:00:00Z"),
				},
				deps,
			)
		).unwrap();
		expect(total?.clicks).toBe(0);
	});
});

describe("listagem", () => {
	it("conta e lista concordam", async () => {
		await campanhaNoAr({ name: "A" });
		await campanhaNoAr({ name: "B", slot: "billboard" });
		const page = await listCampaigns({ slot: "sidebar" }, deps);
		expect(page.items).toHaveLength(1);
		expect(page.total).toBe(1);
	});

	it("busca acha por nome E por anunciante", async () => {
		await campanhaNoAr({ name: "Verão", advertiser: "Padaria Central" });
		expect((await listCampaigns({ search: "verão" }, deps)).items).toHaveLength(
			1,
		);
		expect(
			(await listCampaigns({ search: "padaria" }, deps)).items,
		).toHaveLength(1);
	});
});
