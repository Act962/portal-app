import {
	AdSenseSettings,
	type AdStatsCounter,
	Campaign,
	type CampaignRepository,
	InMemoryAdStatsCounter,
	InMemoryCampaignRepository,
} from "@portal-app/advertising";
import {
	PrismaAdSenseSettingsRepository,
	PrismaAdStatsCounter,
	PrismaCampaignRepository,
} from "@portal-app/advertising/infrastructure/prisma-campaign-repository";
import { newPrismaClient } from "@portal-app/db/client";
import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";

const prisma = newPrismaClient(inject("databaseUrl"));

afterAll(async () => {
	await prisma.$disconnect();
});

const NOW = new Date("2026-09-15T12:00:00Z");

/**
 * O MESMO contrato rodando contra o fake e contra o Postgres.
 *
 * É o teste que impede o fake de mentir: um adapter que filtra período com
 * `>=` onde o domínio usa `>` passaria em todos os testes unitários e serviria
 * um anúncio um dia depois do fim do contrato — em produção, cobrando do portal
 * um espaço que ninguém pagou.
 */
function campanha(
	id: string,
	overrides: {
		slot?: "sidebar" | "billboard";
		status?: "ATIVA" | "PAUSADA" | "RASCUNHO";
		startsAt?: Date;
		endsAt?: Date | null;
		weight?: number;
		sectionIds?: string[];
		mediaId?: string | null;
	} = {},
): Campaign {
	return Campaign.restore({
		id,
		name: `Campanha ${id}`,
		advertiser: "Loja do Zé",
		slot: overrides.slot ?? "sidebar",
		destinationUrl: "https://lojadoze.com.br/",
		startsAt: overrides.startsAt ?? new Date("2026-09-01T00:00:00Z"),
		endsAt: overrides.endsAt === undefined ? null : overrides.endsAt,
		weight: overrides.weight ?? 1,
		sectionIds: overrides.sectionIds ?? [],
		creative:
			overrides.mediaId === null
				? null
				: { mediaId: overrides.mediaId ?? "m-1", altText: "Anúncio" },
		status: overrides.status ?? "ATIVA",
		createdAt: new Date("2026-08-01T00:00:00Z"),
	});
}

type Harness = {
	repo: CampaignRepository;
	stats: AdStatsCounter;
	reset: () => Promise<void>;
};

function fake(): Harness {
	const repo = new InMemoryCampaignRepository();
	const stats = new InMemoryAdStatsCounter();
	return {
		repo,
		stats,
		reset: () => {
			repo.clear();
			stats.clear();
			return Promise.resolve();
		},
	};
}

function prismaHarness(): Harness {
	let seq = 0;
	return {
		repo: new PrismaCampaignRepository(prisma),
		stats: new PrismaAdStatsCounter(prisma, () => `stat-${++seq}`),
		reset: async () => {
			await prisma.adDailyStat.deleteMany();
			await prisma.adCampaign.deleteMany();
		},
	};
}

describe.each([
	["fake", fake],
	["prisma", prismaHarness],
])("CampaignRepository (%s)", (_label, build) => {
	const harness = build();

	beforeEach(async () => {
		await harness.reset();
	});

	it("salva e devolve a campanha inteira", async () => {
		await harness.repo.save(campanha("c-1", { sectionIds: ["s-1", "s-2"] }));
		const lida = await harness.repo.findById("c-1");
		expect(lida?.name).toBe("Campanha c-1");
		expect(lida?.destination.value).toBe("https://lojadoze.com.br/");
		expect([...(lida?.sectionIds ?? [])].sort()).toEqual(["s-1", "s-2"]);
		expect(lida?.creative).toEqual({ mediaId: "m-1", altText: "Anúncio" });
	});

	it("salvar de novo ATUALIZA, não duplica", async () => {
		await harness.repo.save(campanha("c-1"));
		const lida = await harness.repo.findById("c-1");
		lida?.edit({ name: "Outro nome" });
		if (lida) {
			await harness.repo.save(lida);
		}
		expect((await harness.repo.findById("c-1"))?.name).toBe("Outro nome");
		expect(await harness.repo.count()).toBe(1);
	});

	it("id inexistente devolve null", async () => {
		expect(await harness.repo.findById("nao-existe")).toBeNull();
	});

	describe("liveForSlot — o filtro que a veiculação usa", () => {
		it("traz só a posição pedida", async () => {
			await harness.repo.save(campanha("c-1", { slot: "sidebar" }));
			await harness.repo.save(campanha("c-2", { slot: "billboard" }));
			const live = await harness.repo.liveForSlot("sidebar", NOW);
			expect(live.map((c) => c.id)).toEqual(["c-1"]);
		});

		it("descarta pausada e rascunho", async () => {
			await harness.repo.save(campanha("c-1", { status: "PAUSADA" }));
			await harness.repo.save(campanha("c-2", { status: "RASCUNHO" }));
			expect(await harness.repo.liveForSlot("sidebar", NOW)).toEqual([]);
		});

		it("descarta a que ainda não começou", async () => {
			await harness.repo.save(
				campanha("c-1", { startsAt: new Date("2026-10-01T00:00:00Z") }),
			);
			expect(await harness.repo.liveForSlot("sidebar", NOW)).toEqual([]);
		});

		it("descarta a vencida — e o FIM é exclusivo", async () => {
			// O caso que separa o adapter certo do quase-certo: no instante exato do
			// término a campanha JÁ saiu. Um `>=` aqui a manteria no ar um dia
			// inteiro além do contrato.
			await harness.repo.save(campanha("exata", { endsAt: NOW }));
			await harness.repo.save(
				campanha("viva", { endsAt: new Date(NOW.getTime() + 1) }),
			);
			const live = await harness.repo.liveForSlot("sidebar", NOW);
			expect(live.map((c) => c.id)).toEqual(["viva"]);
		});

		it("campanha sem fim combinado continua no ar", async () => {
			await harness.repo.save(campanha("c-1", { endsAt: null }));
			expect(
				(await harness.repo.liveForSlot("sidebar", NOW)).map((c) => c.id),
			).toEqual(["c-1"]);
		});

		it("devolve em ordem ESTÁVEL — o sorteio depende disso", async () => {
			// Ordem instável faria o mesmo `roll` escolher campanhas diferentes
			// entre requisições, e o rodízio deixaria de ser reproduzível.
			await harness.repo.save(campanha("c-3"));
			await harness.repo.save(campanha("c-1"));
			await harness.repo.save(campanha("c-2"));
			const live = await harness.repo.liveForSlot("sidebar", NOW);
			expect(live.map((c) => c.id)).toEqual(["c-1", "c-2", "c-3"]);
		});
	});

	it("conta quantas campanhas usam uma imagem", async () => {
		await harness.repo.save(campanha("c-1", { mediaId: "foto-a" }));
		await harness.repo.save(campanha("c-2", { mediaId: "foto-a" }));
		await harness.repo.save(campanha("c-3", { mediaId: "foto-b" }));
		expect(await harness.repo.countUsingMedia("foto-a")).toBe(2);
		expect(await harness.repo.countUsingMedia("foto-z")).toBe(0);
	});

	it("apagar remove de verdade", async () => {
		await harness.repo.save(campanha("c-1"));
		await harness.repo.delete("c-1");
		expect(await harness.repo.findById("c-1")).toBeNull();
	});

	describe("contador de impressões e cliques", () => {
		beforeEach(async () => {
			await harness.repo.save(campanha("c-1"));
		});

		it("soma no mesmo dia em vez de criar linha nova", async () => {
			// Duas impressões simultâneas são o caso NORMAL num banner de topo. Um
			// "ler, somar, gravar" perderia uma delas em silêncio.
			await harness.stats.recordImpression("c-1", NOW);
			await harness.stats.recordImpression("c-1", NOW);
			await harness.stats.recordClick("c-1", NOW);

			const [total] = await harness.stats.statsFor(
				["c-1"],
				new Date("2026-09-01T00:00:00Z"),
				new Date("2026-10-01T00:00:00Z"),
			);
			expect(total).toEqual({
				campaignId: "c-1",
				impressions: 2,
				clicks: 1,
			});
		});

		it("separa por dia e soma no período", async () => {
			await harness.stats.recordImpression(
				"c-1",
				new Date("2026-09-14T23:00:00Z"),
			);
			await harness.stats.recordImpression(
				"c-1",
				new Date("2026-09-15T01:00:00Z"),
			);
			const [total] = await harness.stats.statsFor(
				["c-1"],
				new Date("2026-09-01T00:00:00Z"),
				new Date("2026-10-01T00:00:00Z"),
			);
			expect(total?.impressions).toBe(2);
		});

		it("evento fora do período não entra", async () => {
			await harness.stats.recordImpression("c-1", NOW);
			const [total] = await harness.stats.statsFor(
				["c-1"],
				new Date("2026-08-01T00:00:00Z"),
				new Date("2026-09-01T00:00:00Z"),
			);
			expect(total?.impressions).toBe(0);
		});

		it("campanha sem evento volta com ZERO, e não some da lista", async () => {
			const [total] = await harness.stats.statsFor(
				["c-1"],
				new Date("2026-09-01T00:00:00Z"),
				new Date("2026-10-01T00:00:00Z"),
			);
			expect(total).toEqual({ campaignId: "c-1", impressions: 0, clicks: 0 });
		});

		it("lista vazia devolve vazio sem consultar", async () => {
			expect(await harness.stats.statsFor([], NOW, NOW)).toEqual([]);
		});
	});
});

/** A configuração do AdSense só tem adapter Prisma (é registro único). */
describe("AdSenseSettingsRepository (prisma)", () => {
	const repo = new PrismaAdSenseSettingsRepository(prisma);

	beforeEach(async () => {
		await prisma.adSenseSettings.deleteMany();
	});

	it("banco SEM linha devolve os padrões — é estado normal, não erro", async () => {
		const settings = await repo.load();
		expect(settings.data.enabled).toBe(false);
		expect(settings.data.publisherId).toBeNull();
		expect(settings.data.nonPersonalized).toBe(true);
	});

	it("salva e relê, inclusive o Json das unidades", async () => {
		const next = AdSenseSettings.change(
			{
				publisherId: "ca-pub-1234567890123456",
				enabled: true,
				slotIds: { sidebar: "111", billboard: "222" },
				nonPersonalized: false,
			},
			AdSenseSettings.restore(null).data,
		).unwrap();
		await repo.save(next);

		const lida = await repo.load();
		expect(lida.data.publisherId).toBe("ca-pub-1234567890123456");
		expect(lida.data.enabled).toBe(true);
		expect(lida.data.slotIds).toEqual({ sidebar: "111", billboard: "222" });
		expect(lida.servesSlot("sidebar")).toBe(true);
		expect(lida.servesSlot("mobile-top")).toBe(false);
	});

	it("salvar duas vezes atualiza a MESMA linha", async () => {
		const base = AdSenseSettings.restore(null).data;
		await repo.save(AdSenseSettings.change({ enabled: true }, base).unwrap());
		await repo.save(AdSenseSettings.change({ enabled: false }, base).unwrap());
		expect(await prisma.adSenseSettings.count()).toBe(1);
		expect((await repo.load()).data.enabled).toBe(false);
	});
});
