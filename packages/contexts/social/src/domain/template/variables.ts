/**
 * As variáveis dos textos da arte (spec 10, D2): o marcador `{{chave}}`, as
 * variáveis do SISTEMA (vindas da matéria) e o que preenche cada uma.
 *
 * Não conhece o padrão nem as caixas de texto — é só texto e valores. Quem junta
 * as duas coisas é o `art-text`.
 */

/** O que a matéria (ou o post avulso) oferece para preencher a arte. */
export type ArtContent = {
	headline: string;
	subtitle: string | null;
	kicker: string | null;
	sectionName: string | null;
	authorName: string | null;
	siteName: string | null;
	/** Quando a arte foi preparada, em ISO. Guardado, e não "agora" na hora de
	 * desenhar, pelo mesmo motivo do resto: a arte aprovada não muda sozinha. */
	date: string | null;
};

/** O que a redação preencheu NESTE post. */
export type ArtInputs = {
	/** Os valores das variáveis do padrão, por chave. */
	values: Readonly<Record<string, string>>;
	/** O texto trocado das caixas Editáveis, por id do elemento. */
	texts: Readonly<Record<string, string>>;
};

export const NO_INPUTS: ArtInputs = { values: {}, texts: {} };

export const SYSTEM_VARIABLES = [
	{
		key: "titulo",
		label: "Título da matéria",
		sample: "Estudantes de Piracuruca são premiados em olimpíada de matemática",
	},
	{
		key: "subtitulo",
		label: "Subtítulo (linha fina)",
		sample: "Grupo de doze alunos da rede municipal volta com seis medalhas",
	},
	{ key: "chapeu", label: "Chapéu", sample: "Últimas" },
	{ key: "editoria", label: "Editoria", sample: "Educação" },
	{ key: "autor", label: "Autor", sample: "Redação" },
	{ key: "site", label: "Nome do site", sample: "Portal 7 Cidades" },
	{ key: "data", label: "Data", sample: "14/09/2026" },
] as const;

export type SystemVariableKey = (typeof SYSTEM_VARIABLES)[number]["key"];

export const SYSTEM_VARIABLE_KEYS: readonly string[] = SYSTEM_VARIABLES.map(
	(variable) => variable.key,
);

/** Chave de variável: minúscula, dígitos e `_`, começando por letra. */
export const VARIABLE_KEY = /^[a-z][a-z0-9_]{0,31}$/;

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** As chaves citadas no texto, sem repetir, na ordem em que aparecem. */
export function tokensIn(text: string): string[] {
	const keys = [...text.matchAll(TOKEN)].map((match) => match[1] ?? "");
	return [...new Set(keys)];
}

/** O texto com cada `{{chave}}` trocado pelo valor; chave sem valor vira "". */
export function fillTokens(
	text: string,
	values: Readonly<Record<string, string>>,
): string {
	return text.replace(TOKEN, (_match, key: string) =>
		Object.hasOwn(values, key) ? (values[key] ?? "") : "",
	);
}

/** A data da arte como o leitor lê: dd/mm/aaaa, no fuso do veículo. */
export function formatArtDate(iso: string | null): string {
	if (!iso) {
		return "";
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "America/Sao_Paulo",
	}).format(date);
}

/** Os valores das variáveis do sistema para um conteúdo. */
export function systemValues(
	content: ArtContent,
): Record<SystemVariableKey, string> {
	return {
		titulo: content.headline,
		subtitulo: content.subtitle ?? "",
		chapeu: content.kicker ?? "",
		editoria: content.sectionName ?? "",
		autor: content.authorName ?? "",
		site: content.siteName ?? "",
		data: formatArtDate(content.date),
	};
}

/** O conteúdo de exemplo do editor — os `sample` das variáveis do sistema. */
export const SAMPLE_CONTENT: ArtContent = {
	headline: SYSTEM_VARIABLES[0].sample,
	subtitle: SYSTEM_VARIABLES[1].sample,
	kicker: SYSTEM_VARIABLES[2].sample,
	sectionName: SYSTEM_VARIABLES[3].sample,
	authorName: SYSTEM_VARIABLES[4].sample,
	siteName: SYSTEM_VARIABLES[5].sample,
	date: "2026-09-14T15:00:00.000Z",
};

/** Um conteúdo só com o título — o post avulso, que não veio de matéria. */
export function contentWithHeadline(headline: string): ArtContent {
	return {
		headline,
		subtitle: null,
		kicker: null,
		sectionName: null,
		authorName: null,
		siteName: null,
		date: null,
	};
}
