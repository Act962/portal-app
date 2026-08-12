import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	InvalidEmail,
	InvalidLinkHref,
	InvalidUrl,
	RequiredField,
	type SettingsError,
} from "./errors";
import { SiteSettingsChanged } from "./events";

/** Um destino do rodapé, do topo ou das redes. */
export type Link = { label: string; href: string };

export type SiteSettingsData = {
	// Identidade
	name: string;
	shortName: string;
	tagline: string;
	description: string;
	url: string;
	city: string;
	state: string;
	logoMediaId: string | null;

	// Rádio (D11)
	radioFrequency: string | null;
	radioBand: string | null;

	// Contato
	contactNewsroom: string | null;
	contactWhatsapp: string | null;
	contactEmail: string | null;
	contactAddress: string | null;

	// Listas curtas, guardadas em Json (D13)
	social: Link[];
	institutional: Link[];
	popularSearches: string[];

	legal: string | null;
};

/**
 * O que o portal mostra antes de alguém abrir a tela de configurações (D7).
 *
 * Não é conteúdo de exemplo: é o estado inicial real deste veículo. Existir aqui
 * — e não em `apps/web` — é o que garante que o portal, o painel e o banco vazio
 * concordem sobre o mesmo ponto de partida.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
	name: "Rádio 7 Cidades",
	shortName: "7 Cidades",
	tagline: "NOTÍCIAS DO PIAUÍ · 93,9 FM",
	description:
		"Notícias do Piauí 24 horas no ar. Política, cidades, economia e esportes de Piracuruca e região, com a Rádio 7 Cidades 93,9 FM.",
	url: "https://fm7cidades.com",
	city: "Piracuruca",
	state: "PI",
	logoMediaId: null,

	radioFrequency: "93,9 MHz",
	radioBand: "93,9 FM",

	contactNewsroom: "(86) 3343-1107",
	contactWhatsapp: "(86) 9 9999-0000",
	contactEmail: "contato@fm7cidades.com",
	contactAddress: "BR-343, km 140 · Piracuruca",

	social: [
		{ label: "Instagram", href: "https://instagram.com" },
		{ label: "Facebook", href: "https://facebook.com" },
		{ label: "YouTube", href: "https://youtube.com" },
	],
	// Só o que EXISTE. Eram seis itens, todos com `href: ""` — o `SiteLink` os
	// degradava para texto inerte (D9), o que evita o clique morto mas ainda
	// anuncia no rodapé seis serviços que o portal não tem. Restaram os dois
	// que viraram página de verdade; os outros voltam quando a página existir,
	// e enquanto isso qualquer um pode ser recadastrado pela tela de
	// Configurações.
	institutional: [
		{ label: "Colunistas", href: "/colunistas" },
		{ label: "Enquetes", href: "/enquetes" },
	],
	popularSearches: [
		"Concurso público",
		"Piracuruca",
		"Eleições 2026",
		"Vaquejada",
		"BR-343",
		"Programação",
	],

	// A linha da razão social, ao lado do copyright. Trazia
	// "PRINCÍPIOS EDITORIAIS · PRIVACIDADE · TERMOS DE USO", que PARECIA um
	// menu de links e era só texto impresso — as três não levavam a lugar
	// nenhum. Privacidade e Termos agora são links de verdade no rodapé; este
	// campo volta a ser o que o nome dele diz.
	legal: null,
};

const REQUIRED_FIELDS = [
	"name",
	"shortName",
	"tagline",
	"description",
	"url",
	"city",
	"state",
] as const satisfies readonly (keyof SiteSettingsData)[];

/**
 * Configuração do veículo — agregado de linha única.
 *
 * Duas portas, pelo mesmo motivo que o `Body` do editorial tem duas: LER e
 * ESCREVER têm exigências opostas. `fromStored` nunca falha, porque o portal não
 * pode ficar fora do ar por um campo torto no banco; `update` valida, porque é
 * ali que o dado entra e é o único momento em que dá para recusar.
 *
 * Não existe `create`: a configuração conceitualmente sempre existe — antes da
 * primeira edição ela é o default (D7). Isso elimina o estado "não configurado",
 * que seria mais um caminho para o portal quebrar.
 */
export class SiteSettings extends AggregateRoot<string> {
	/** Linha única, garantida pela chave primária, sem "pega o primeiro" (D6). */
	static readonly ID = "singleton";

	private state: SiteSettingsData;

	private constructor(state: SiteSettingsData) {
		super(SiteSettings.ID);
		this.state = state;
	}

	/**
	 * Porta de LEITURA. Mescla o que veio do banco sobre os defaults e **nunca
	 * falha** — campo ausente, nulo ou de tipo errado cai no default em silêncio.
	 */
	static fromStored(
		raw: Partial<Record<keyof SiteSettingsData, unknown>> | null | undefined,
	): SiteSettings {
		const d = DEFAULT_SITE_SETTINGS;
		const row = raw ?? {};

		return new SiteSettings({
			name: text(row.name, d.name),
			shortName: text(row.shortName, d.shortName),
			tagline: text(row.tagline, d.tagline),
			description: text(row.description, d.description),
			url: text(row.url, d.url),
			city: text(row.city, d.city),
			state: text(row.state, d.state),
			logoMediaId: nullableText(row.logoMediaId),

			radioFrequency: nullableText(row.radioFrequency) ?? d.radioFrequency,
			radioBand: nullableText(row.radioBand) ?? d.radioBand,

			contactNewsroom: nullableText(row.contactNewsroom) ?? d.contactNewsroom,
			contactWhatsapp: nullableText(row.contactWhatsapp) ?? d.contactWhatsapp,
			contactEmail: nullableText(row.contactEmail) ?? d.contactEmail,
			contactAddress: nullableText(row.contactAddress) ?? d.contactAddress,

			social: links(row.social) ?? d.social,
			institutional: links(row.institutional) ?? d.institutional,
			popularSearches: strings(row.popularSearches) ?? d.popularSearches,

			legal: nullableText(row.legal) ?? d.legal,
		});
	}

	/** Cópia defensiva: quem lê não altera o agregado por engano. */
	get data(): SiteSettingsData {
		return {
			...this.state,
			social: this.state.social.map((link) => ({ ...link })),
			institutional: this.state.institutional.map((link) => ({ ...link })),
			popularSearches: [...this.state.popularSearches],
		};
	}

	/**
	 * Porta de ESCRITA. Aplica só as chaves presentes no `patch`, valida o
	 * resultado inteiro e registra o evento com os campos que de fato mudaram —
	 * salvar sem alterar nada não polui a auditoria.
	 */
	update(
		patch: Partial<SiteSettingsData>,
		now: Date,
	): Result<SiteSettings, SettingsError> {
		const next: SiteSettingsData = { ...this.data };

		for (const key of Object.keys(patch) as (keyof SiteSettingsData)[]) {
			const value = patch[key];
			if (value !== undefined) {
				// A união de tipos por chave não sobrevive ao índice dinâmico; o
				// `patch` já é `Partial<SiteSettingsData>`, então a chave e o valor
				// casam por construção.
				(next as Record<string, unknown>)[key] = value;
			}
		}

		const normalized = normalize(next);
		if (normalized.isErr()) {
			return err(normalized.error);
		}

		const value = normalized.unwrap();
		const changed = changedFields(this.state, value);
		this.state = value;

		if (changed.length > 0) {
			this.record(new SiteSettingsChanged(changed, now));
		}

		return ok(this);
	}
}

// --- Validação e normalização ----------------------------------------------

function normalize(
	data: SiteSettingsData,
): Result<SiteSettingsData, SettingsError> {
	const out: SiteSettingsData = {
		...data,
		name: data.name.trim(),
		shortName: data.shortName.trim(),
		tagline: data.tagline.trim(),
		description: data.description.trim(),
		url: data.url.trim(),
		city: data.city.trim(),
		state: data.state.trim(),
		logoMediaId: blankToNull(data.logoMediaId),
		radioFrequency: blankToNull(data.radioFrequency),
		radioBand: blankToNull(data.radioBand),
		contactNewsroom: blankToNull(data.contactNewsroom),
		contactWhatsapp: blankToNull(data.contactWhatsapp),
		contactEmail: blankToNull(data.contactEmail),
		contactAddress: blankToNull(data.contactAddress),
		legal: blankToNull(data.legal),
		popularSearches: data.popularSearches
			.map((term) => term.trim())
			.filter(Boolean),
	};

	for (const field of REQUIRED_FIELDS) {
		if (!out[field]) {
			return err(new RequiredField(field));
		}
	}

	// A URL canônica do portal precisa ser absoluta: ela vira `<link rel=canonical>`,
	// og:url e endereço no sitemap, onde caminho relativo não significa nada.
	if (!isHttpUrl(out.url)) {
		return err(new InvalidUrl("url", out.url));
	}

	if (out.contactEmail && !isEmail(out.contactEmail)) {
		return err(new InvalidEmail(out.contactEmail));
	}

	const social = normalizeLinks(data.social);
	if (social.isErr()) {
		return err(social.error);
	}
	out.social = social.unwrap();

	const institutional = normalizeLinks(data.institutional);
	if (institutional.isErr()) {
		return err(institutional.error);
	}
	out.institutional = institutional.unwrap();

	return ok(out);
}

function normalizeLinks(list: Link[]): Result<Link[], SettingsError> {
	const out: Link[] = [];

	for (const raw of list) {
		const label = (raw?.label ?? "").trim();
		const href = (raw?.href ?? "").trim();

		// Item sem rótulo é ruído de formulário (linha em branco), não erro.
		if (!label) {
			continue;
		}

		// href vazio é PERMITIDO e vira texto, não link (D9). O que se recusa é o
		// href preenchido e inválido — que renderiza um link que não navega.
		if (href && !isLinkHref(href)) {
			return err(new InvalidLinkHref(href));
		}

		out.push({ label, href });
	}

	return ok(out);
}

function isHttpUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Aceita URL absoluta `http(s)` ou caminho interno (`/quem-somos`).
 *
 * O caminho interno não estava na letra da spec, mas é para onde os links
 * institucionais vão quando as páginas existirem — e recusá-lo obrigaria a
 * escrever o domínio inteiro só para linkar uma página do próprio portal.
 * `javascript:` e `data:` continuam recusados, que é o risco real.
 */
function isLinkHref(value: string): boolean {
	if (value.startsWith("//")) {
		return false;
	}
	return value.startsWith("/") || isHttpUrl(value);
}

function isEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function changedFields(
	before: SiteSettingsData,
	after: SiteSettingsData,
): string[] {
	const keys = Object.keys(after) as (keyof SiteSettingsData)[];
	return keys.filter(
		(key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
	);
}

// --- Coerção da leitura (nunca falha) --------------------------------------

function text(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableText(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value : null;
}

function blankToNull(value: string | null): string | null {
	const trimmed = (value ?? "").trim();
	return trimmed || null;
}

function links(value: unknown): Link[] | null {
	if (!Array.isArray(value)) {
		return null;
	}
	const out: Link[] = [];
	for (const item of value) {
		if (item && typeof item === "object") {
			const label = (item as { label?: unknown }).label;
			const href = (item as { href?: unknown }).href;
			if (typeof label === "string" && label.trim()) {
				out.push({
					label,
					href: typeof href === "string" ? href : "",
				});
			}
		}
	}
	return out;
}

function strings(value: unknown): string[] | null {
	if (!Array.isArray(value)) {
		return null;
	}
	return value.filter(
		(item): item is string => typeof item === "string" && item.trim() !== "",
	);
}
