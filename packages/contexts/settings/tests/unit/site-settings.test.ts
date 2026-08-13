import { describe, expect, it } from "vitest";

import {
	DEFAULT_SITE_SETTINGS,
	InvalidEmail,
	InvalidLinkHref,
	InvalidUrl,
	RequiredField,
	SiteSettings,
	SiteSettingsChanged,
} from "../../src/index";

const NOW = new Date("2026-08-06T12:00:00-03:00");

/** O agregado sempre existe; partir do default é o estado inicial real (D7). */
function current(): SiteSettings {
	return SiteSettings.fromStored(null);
}

describe("SiteSettings.fromStored — porta de leitura, nunca falha", () => {
	it("sem linha no banco, devolve os defaults", () => {
		expect(current().data).toEqual(DEFAULT_SITE_SETTINGS);
	});

	it("mescla o que veio do banco sobre os defaults", () => {
		const settings = SiteSettings.fromStored({ name: "Rádio Nova" });

		expect(settings.data.name).toBe("Rádio Nova");
		// O que não veio continua valendo — é isto que impede o portal de nascer
		// pela metade quando um campo novo entra antes de ser preenchido.
		expect(settings.data.tagline).toBe(DEFAULT_SITE_SETTINGS.tagline);
	});

	it("campo de tipo errado cai no default em silêncio, sem quebrar o portal", () => {
		const settings = SiteSettings.fromStored({
			name: 42,
			social: "não é uma lista",
			popularSearches: { nem: "isto" },
		});

		expect(settings.data.name).toBe(DEFAULT_SITE_SETTINGS.name);
		expect(settings.data.social).toEqual(DEFAULT_SITE_SETTINGS.social);
		expect(settings.data.popularSearches).toEqual(
			DEFAULT_SITE_SETTINGS.popularSearches,
		);
	});

	it("string vazia conta como ausente", () => {
		expect(SiteSettings.fromStored({ name: "   " }).data.name).toBe(
			DEFAULT_SITE_SETTINGS.name,
		);
	});

	it("descarta item de lista sem rótulo e completa href ausente", () => {
		const settings = SiteSettings.fromStored({
			social: [{ label: "X", href: 7 }, { label: "" }, null, "lixo"],
		});

		expect(settings.data.social).toEqual([{ label: "X", href: "" }]);
	});

	it("linha completa no banco vence os defaults em todos os campos", () => {
		const stored = {
			name: "Rádio Nova",
			shortName: "Nova",
			tagline: "A SUA RÁDIO",
			description: "Notícias de verdade.",
			url: "https://radionova.com",
			city: "Teresina",
			state: "PI",
			logoMediaId: "media-1",
			faviconMediaId: "media-2",
			ogImageMediaId: "media-3",
			radioFrequency: "101,1 MHz",
			radioBand: "101,1 FM",
			contactNewsroom: "(86) 1111-1111",
			contactWhatsapp: "(86) 9 2222-2222",
			contactEmail: "oi@radionova.com",
			contactAddress: "Centro, Teresina",
			social: [{ label: "Instagram", href: "https://instagram.com/nova" }],
			institutional: [{ label: "Quem somos", href: "/quem-somos" }],
			popularSearches: ["Eleições"],
			legal: "TERMOS",
		};

		expect(SiteSettings.fromStored(stored).data).toEqual(stored);
	});

	it("filtra termos de busca que não são texto", () => {
		const settings = SiteSettings.fromStored({
			popularSearches: ["Eleições", 7, "", null, "  ", "BR-343"],
		});

		expect(settings.data.popularSearches).toEqual(["Eleições", "BR-343"]);
	});

	it("o id é sempre o singleton", () => {
		expect(current().id).toBe(SiteSettings.ID);
	});

	it("data devolve cópia defensiva", () => {
		const settings = current();
		settings.data.social.push({ label: "Intruso", href: "https://x.com" });

		expect(settings.data.social).toEqual(DEFAULT_SITE_SETTINGS.social);
	});
});

describe("SiteSettings.update — porta de escrita, valida", () => {
	it("aplica só as chaves presentes no patch", () => {
		const settings = current();
		const result = settings.update({ city: "Teresina" }, NOW);

		expect(result.isOk()).toBe(true);
		expect(settings.data.city).toBe("Teresina");
		expect(settings.data.state).toBe(DEFAULT_SITE_SETTINGS.state);
	});

	it("apara espaços", () => {
		const settings = current();
		settings.update({ name: "  Rádio Nova  " }, NOW);

		expect(settings.data.name).toBe("Rádio Nova");
	});

	it("recusa campo obrigatório vazio", () => {
		const result = current().update({ name: "   " }, NOW);

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(RequiredField);
	});

	it("recusa URL do portal que não seja http(s)", () => {
		const result = current().update({ url: "fm7cidades.com" }, NOW);

		expect(result.unwrapErr()).toBeInstanceOf(InvalidUrl);
	});

	it("campo opcional em branco vira null", () => {
		const settings = current();
		settings.update({ radioBand: "  ", legal: "" }, NOW);

		expect(settings.data.radioBand).toBeNull();
		expect(settings.data.legal).toBeNull();
	});

	it("recusa e-mail fora de formato", () => {
		const result = current().update({ contactEmail: "contato@" }, NOW);

		expect(result.unwrapErr()).toBeInstanceOf(InvalidEmail);
	});

	it("limpa termos de busca vazios", () => {
		const settings = current();
		settings.update({ popularSearches: ["  Eleições  ", "", "   "] }, NOW);

		expect(settings.data.popularSearches).toEqual(["Eleições"]);
	});
});

describe("destinos de link (D9)", () => {
	it("aceita URL absoluta https", () => {
		const result = current().update(
			{
				social: [{ label: "Instagram", href: "https://instagram.com/radio7" }],
			},
			NOW,
		);

		expect(result.isOk()).toBe(true);
	});

	it("aceita caminho interno, para onde os institucionais vão", () => {
		const settings = current();
		const result = settings.update(
			{ institutional: [{ label: "Quem somos", href: "/quem-somos" }] },
			NOW,
		);

		expect(result.isOk()).toBe(true);
		expect(settings.data.institutional[0]?.href).toBe("/quem-somos");
	});

	it("aceita href vazio: vira texto, não link", () => {
		const settings = current();
		const result = settings.update(
			{ institutional: [{ label: "Quem somos", href: "" }] },
			NOW,
		);

		expect(result.isOk()).toBe(true);
		expect(settings.data.institutional[0]?.href).toBe("");
	});

	it.each([
		["javascript:alert(1)", "javascript:"],
		["data:text/html,<script>", "data:"],
		["quem-somos", "texto solto"],
		["//evil.com", "protocolo relativo"],
	])("recusa %s (%s)", (href) => {
		const result = current().update(
			{ institutional: [{ label: "X", href }] },
			NOW,
		);

		expect(result.unwrapErr()).toBeInstanceOf(InvalidLinkHref);
	});

	it("vale para as redes também, não só para os institucionais", () => {
		const result = current().update(
			{ social: [{ label: "Instagram", href: "javascript:void(0)" }] },
			NOW,
		);

		expect(result.unwrapErr()).toBeInstanceOf(InvalidLinkHref);
	});

	it("descarta linha em branco do formulário sem virar erro", () => {
		const settings = current();
		const result = settings.update(
			{
				social: [
					{ label: "  ", href: "" },
					{ label: "YouTube", href: "https://youtube.com/@radio7" },
				],
			},
			NOW,
		);

		expect(result.isOk()).toBe(true);
		expect(settings.data.social).toEqual([
			{ label: "YouTube", href: "https://youtube.com/@radio7" },
		]);
	});
});

describe("auditoria (D10)", () => {
	it("registra o evento com os campos alterados", () => {
		const settings = current();
		settings.update({ city: "Teresina", contactEmail: "novo@r7.com" }, NOW);

		const [event] = settings.pullEvents();

		expect(event).toBeInstanceOf(SiteSettingsChanged);
		expect((event as SiteSettingsChanged).fields).toEqual([
			"city",
			"contactEmail",
		]);
		expect(event?.occurredAt).toEqual(NOW);
	});

	it("não carrega os VALORES — telefone e e-mail não vão para o log", () => {
		const settings = current();
		settings.update({ contactWhatsapp: "(86) 9 1234-5678" }, NOW);

		const serialized = JSON.stringify(settings.pullEvents());

		expect(serialized).not.toContain("1234-5678");
		expect(serialized).toContain("contactWhatsapp");
	});

	it("salvar sem mudar nada não polui a auditoria", () => {
		const settings = current();
		settings.update({ name: DEFAULT_SITE_SETTINGS.name }, NOW);

		expect(settings.pullEvents()).toHaveLength(0);
	});

	it("patch vazio é no-op válido", () => {
		const settings = current();

		expect(settings.update({}, NOW).isOk()).toBe(true);
		expect(settings.pullEvents()).toHaveLength(0);
	});

	it("update recusado não altera o estado nem registra evento", () => {
		const settings = current();
		settings.update({ url: "quebrado" }, NOW);

		expect(settings.data.url).toBe(DEFAULT_SITE_SETTINGS.url);
		expect(settings.pullEvents()).toHaveLength(0);
	});
});

describe("favicon", () => {
	it("nasce ausente — o portal cai no arquivo de public/", () => {
		expect(DEFAULT_SITE_SETTINGS.faviconMediaId).toBeNull();
	});

	it("é campo PRÓPRIO, não o logo reusado", () => {
		// O logo é horizontal e legível a 200px; o favicon é quadrado e precisa
		// funcionar a 16px. Servir um como o outro borra em algum dos dois
		// lugares — por isso são duas colunas, e este teste é o que impede
		// alguém de "simplificar" juntando-as.
		const settings = SiteSettings.fromStored({
			logoMediaId: "logo",
			faviconMediaId: "icone",
		});

		expect(settings.data.logoMediaId).toBe("logo");
		expect(settings.data.faviconMediaId).toBe("icone");
	});

	it("vazio na tela vira ausência, e volta ao ícone padrão", () => {
		const settings = SiteSettings.fromStored({ faviconMediaId: "icone" });

		settings.update({ faviconMediaId: "" }, NOW).unwrap();

		expect(settings.data.faviconMediaId).toBeNull();
	});
});

describe("imagem de compartilhamento", () => {
	it("nasce ausente — o portal gera um cartão com o título da página", () => {
		expect(DEFAULT_SITE_SETTINGS.ogImageMediaId).toBeNull();
	});

	it("é a TERCEIRA coluna de imagem, e não o logo reusado", () => {
		// Mesma razão que separou o favicon, com outra medida: aqui a caixa é
		// 1200×630, e um logo horizontal nela sai esticado ou entre faixas. As
		// três servem a recortes diferentes e não se substituem.
		const settings = SiteSettings.fromStored({
			logoMediaId: "logo",
			faviconMediaId: "icone",
			ogImageMediaId: "arte",
		});

		expect(settings.data.logoMediaId).toBe("logo");
		expect(settings.data.faviconMediaId).toBe("icone");
		expect(settings.data.ogImageMediaId).toBe("arte");
	});

	it("vazio na tela vira ausência, e volta ao cartão gerado", () => {
		const settings = SiteSettings.fromStored({ ogImageMediaId: "arte" });

		settings.update({ ogImageMediaId: "" }, NOW).unwrap();

		expect(settings.data.ogImageMediaId).toBeNull();
	});
});
