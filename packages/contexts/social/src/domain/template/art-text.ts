import type { ArtSelection } from "./art-selection";
import {
	type ArtDesign,
	type TextElement,
	textElementsOf,
} from "./art-template";
import {
	type ArtContent,
	type ArtInputs,
	fillTokens,
	NO_INPUTS,
	systemValues,
	tokensIn,
} from "./variables";

/**
 * O texto que cada caixa da arte mostra (spec 10, D2 e D3) e os campos que o
 * post oferece para preencher.
 *
 * Função pura dos três ingredientes — o desenho, o conteúdo da matéria e o que
 * a redação preencheu —, usada igual pelo editor, pela prévia do post e pelo
 * desenhista do servidor. É o que garante que a tela e a arte publicada digam a
 * mesma coisa.
 */

/** Todas as variáveis com valor: as do sistema e as do padrão. */
export function valuesFor(
	design: ArtDesign,
	content: ArtContent,
	values: ArtInputs["values"] = {},
): Record<string, string> {
	const resolved: Record<string, string> = { ...systemValues(content) };
	for (const variable of design.variables) {
		resolved[variable.key] = Object.hasOwn(values, variable.key)
			? (values[variable.key] ?? "")
			: variable.defaultValue;
	}
	return resolved;
}

/**
 * O texto da caixa ANTES da caixa-alta — o que um campo mostra para editar.
 *
 * Estático é literal. Dinâmico resolve as variáveis. Editável resolve e, se a
 * redação trocou o texto neste post, vale o trocado (mesmo vazio: apagar é uma
 * escolha legítima).
 */
export function plainTextFor(
	element: TextElement,
	design: ArtDesign,
	content: ArtContent,
	inputs: ArtInputs = NO_INPUTS,
): string {
	if (element.mode === "EDITABLE" && Object.hasOwn(inputs.texts, element.id)) {
		return normalize(inputs.texts[element.id] ?? "");
	}
	return normalize(resolvedContent(element, design, content, inputs.values));
}

/** O texto final da caixa, com a caixa-alta do estilo aplicada. */
export function textFor(
	element: TextElement,
	design: ArtDesign,
	content: ArtContent,
	inputs: ArtInputs = NO_INPUTS,
): string {
	const plain = plainTextFor(element, design, content, inputs);
	// pt-BR explícito: é o que garante "AÇÃO" e não depende do idioma do servidor.
	return element.style.uppercase ? plain.toLocaleUpperCase("pt-BR") : plain;
}

/** O texto final de cada caixa, por id. */
export function textsFor(
	design: ArtDesign,
	content: ArtContent,
	inputs: ArtInputs = NO_INPUTS,
): Record<string, string> {
	return Object.fromEntries(
		textElementsOf(design).map((element) => [
			element.id,
			textFor(element, design, content, inputs),
		]),
	);
}

function resolvedContent(
	element: TextElement,
	design: ArtDesign,
	content: ArtContent,
	values: ArtInputs["values"],
): string {
	return element.mode === "STATIC"
		? element.content
		: fillTokens(element.content, valuesFor(design, content, values));
}

/**
 * Espaços repetidos viram um, mas a quebra de linha digitada fica — "ESTUDANTES
 * DE PIRACURUCA↵SÃO PREMIADOS" é decisão de diagramação.
 */
function normalize(text: string): string {
	return text
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.join("\n")
		.trim();
}

// ── campos do post (D3) ─────────────────────────────────────────────────────

export type VariableField = {
	key: string;
	label: string;
	multiline: boolean;
	value: string;
	defaultValue: string;
	/** O post tem valor próprio para esta variável? */
	changed: boolean;
};

export type EditableTextField = {
	elementId: string;
	label: string;
	/** O que está no campo: o trocado, ou o resolvido. */
	value: string;
	/** O resolvido pelas variáveis — o que volta ao desfazer a troca. */
	original: string;
	overridden: boolean;
};

export type ArtFields = {
	variables: VariableField[];
	texts: EditableTextField[];
};

/**
 * O que o post oferece para preencher: as variáveis DO PADRÃO que alguma caixa
 * usa, e as caixas Editáveis. As do sistema não viram campo — vêm da matéria;
 * para mexer nelas num post, o designer marca a caixa como Editável (D3).
 */
export function artFields(
	selection: ArtSelection,
	content: ArtContent,
): ArtFields {
	const { design } = selection;
	const texts = textElementsOf(design);
	const used = new Set(
		texts
			.filter((element) => element.mode !== "STATIC")
			.flatMap((element) => tokensIn(element.content)),
	);
	return {
		variables: design.variables
			.filter((variable) => used.has(variable.key))
			.map((variable) => {
				const changed = Object.hasOwn(selection.values, variable.key);
				return {
					key: variable.key,
					label: variable.label,
					multiline: variable.multiline,
					value: changed
						? (selection.values[variable.key] ?? "")
						: variable.defaultValue,
					defaultValue: variable.defaultValue,
					changed,
				};
			}),
		texts: texts
			.filter((element) => element.mode === "EDITABLE")
			.map((element) => {
				const original = plainTextFor(element, design, content, {
					values: selection.values,
					texts: {},
				});
				const overridden = Object.hasOwn(selection.texts, element.id);
				return {
					elementId: element.id,
					label: element.fieldLabel,
					value: overridden ? (selection.texts[element.id] ?? "") : original,
					original,
					overridden,
				};
			}),
	};
}

/**
 * O que o post guarda depois de editar uma variável. Voltar ao valor padrão
 * APAGA o valor próprio: senão o post deixaria de acompanhar o padrão sem
 * ninguém ter decidido isso.
 */
export function inputsAfterVariableEdit(
	selection: ArtSelection,
	key: string,
	value: string,
): ArtInputs {
	const variable = selection.design.variables.find((item) => item.key === key);
	const { [key]: _previous, ...rest } = selection.values;
	const values =
		!variable || value === variable.defaultValue
			? rest
			: { ...rest, [key]: value };
	return { values, texts: { ...selection.texts } };
}

/**
 * O que o post guarda depois de editar uma caixa Editável. Voltar ao texto
 * resolvido APAGA a troca: a matéria corrigida depois continua chegando à arte.
 */
export function inputsAfterTextEdit(
	selection: ArtSelection,
	content: ArtContent,
	elementId: string,
	value: string,
): ArtInputs {
	const field = artFields(selection, content).texts.find(
		(item) => item.elementId === elementId,
	);
	const { [elementId]: _previous, ...rest } = selection.texts;
	const texts =
		!field || value.trim() === field.original.trim()
			? rest
			: { ...rest, [elementId]: value };
	return { values: { ...selection.values }, texts };
}
