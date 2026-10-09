import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
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
	/**
	 * O ícone da ABA do navegador. Separado do logo de propósito: o logo é
	 * horizontal e legível a 200px, o favicon é quadrado e precisa funcionar a
	 * 16px. Reaproveitar um no outro dá borrão em algum dos dois lugares.
	 */
	faviconMediaId: string | null;
	/**
	 * A arte que aparece quando alguém cola um link do portal no WhatsApp
	 * (`og:image`). Terceira coluna de imagem, e não o logo reaproveitado, pela
	 * mesma razão que separou o favicon: aqui a caixa é **1200×630**, e um logo
	 * horizontal nela sai esticado ou boiando entre faixas. Formato também
	 * importa — SVG não é aceito por WhatsApp nem Facebook.
	 *
	 * Nulo é estado normal: sem arte cadastrada o portal gera um cartão com o
	 * título da página (spec 07, D4), que é legível e nunca deforma.
	 */
	ogImageMediaId: string | null;

	/**
	 * O bloco CONTATO do rodapé: uma linha de texto livre por item, na ordem em
	 * que aparecem.
	 *
	 * Eram quatro campos fixos (redação, WhatsApp, e-mail, endereço), e a
	 * leitura trocava campo vazio pelo valor padrão — apagar o e-mail na tela
	 * trazia de volta o e-mail de exemplo, e não havia como tirá-lo do ar. Lista
	 * não tem esse problema: vazia é vazia, e a redação escreve o que quiser.
	 */
	contactLines: string[];

	// Listas curtas, guardadas em Json (D13)
	social: Link[];
	institutional: Link[];
	popularSearches: string[];

	/**
	 * A frase do rodapé, logo abaixo da marca.
	 *
	 * Separada de `tagline` de propósito: aquela é IDENTIDADE (curta, em caixa
	 * alta, e vai para `og:site_name`, cabeçalho e schema.org); esta é COPY de
	 * rodapé — uma frase inteira que a redação reescreve quando quiser sem
	 * mudar o que os buscadores leem sobre o veículo.
	 *
	 * Antes era texto FIXO no `site-footer.tsx`, montado a partir da frequência
	 * e da cidade. Trocá-la custava um deploy; agora é um campo da tela de
	 * Configurações.
	 */
	footerTagline: string | null;

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
	faviconMediaId: null,
	ogImageMediaId: null,

	contactLines: [
		"Redação · (86) 3343-1107",
		"WhatsApp · (86) 9 9999-0000",
		"contato@fm7cidades.com",
		"BR-343, km 140 · Piracuruca",
	],

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

	footerTagline:
		"Portal 7 Cidades — O Piauí bem informado, o Brasil conectado.",

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
			faviconMediaId: nullableText(row.faviconMediaId),
			ogImageMediaId: nullableText(row.ogImageMediaId),

			// Lista VAZIA é resposta válida e fica vazia — o default só entra
			// quando não há lista nenhuma (banco sem a linha de configuração).
			contactLines: strings(row.contactLines) ?? d.contactLines,

			social: links(row.social) ?? d.social,
			institutional: links(row.institutional) ?? d.institutional,
			popularSearches: strings(row.popularSearches) ?? d.popularSearches,

			footerTagline: nullableText(row.footerTagline) ?? d.footerTagline,

			legal: nullableText(row.legal) ?? d.legal,
		});
	}

	/** Cópia defensiva: quem lê não altera o agregado por engano. */
	get data(): SiteSettingsData {
		return {
			...this.state,
			social: this.state.social.map((link) => ({ ...link })),
			institutional: this.state.institutional.map((link) => ({ ...link })),
			contactLines: [...this.state.contactLines],
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
		faviconMediaId: blankToNull(data.faviconMediaId),
		ogImageMediaId: blankToNull(data.ogImageMediaId),
		// Linha em branco é ruído de formulário, não erro — some ao salvar.
		contactLines: data.contactLines.map((line) => line.trim()).filter(Boolean),
		footerTagline: blankToNull(data.footerTagline),
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

/**
 * O e-mail e o telefone que as linhas de contato trazem, quando trazem.
 *
 * As linhas são texto livre, mas dois lugares precisam do DADO e não da frase:
 * o schema.org (`email`, `telephone`) e o "escreva para…" das páginas legais.
 * Vale o primeiro de cada tipo, na ordem das linhas — quem quer outro telefone
 * no Google sobe a linha dele. Sem nenhum, `null`: quem lê já omite o campo.
 */
export function contactChannels(lines: readonly string[]): {
	email: string | null;
	phone: string | null;
} {
	let email: string | null = null;
	let phone: string | null = null;

	for (const line of lines) {
		email ??=
			line.match(/[^\s@·|,;:()<>]+@[^\s@·|,;:()<>]+\.[a-z]{2,}/i)?.[0] ?? null;
		// Ao menos 10 dígitos (DDD + número): é o que separa um telefone do
		// "km 140" e do CEP de uma linha de endereço.
		const candidate = line.match(/\+?\(?\d[\d\s().-]{6,}\d/)?.[0] ?? null;
		if (candidate && candidate.replace(/\D/g, "").length >= 10) {
			phone ??= candidate;
		}
	}

	return { email, phone };
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
