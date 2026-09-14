import {
	type ArtContent,
	type ArtFormat,
	type ArtSelection,
	formatServes,
	type SocialDestination,
	type TemplateLayer,
	type TextLayer,
	type TextOverrides,
	textForLayer,
} from "@portal-app/social";

/**
 * A lógica da seção "Arte" do editor do post, SEM JSX e SEM React (regra de
 * testes do projeto).
 *
 * Três perguntas que a tela faz o tempo todo — que padrões servem a este
 * destino, que texto mostrar em cada caixa, o que mandar para a prévia — e cada
 * uma respondida à mão dentro do componente seria uma chance de a tela divergir
 * do que o servidor desenha.
 */

/** O mínimo de um padrão que a tela precisa para oferecê-lo. */
export type TemplateChoice = {
	id: string;
	name: string;
	format: ArtFormat;
	archived: boolean;
	defaultFor: readonly SocialDestination[];
};

/**
 * Os padrões que servem a este destino, ativos, por nome — o padrão do destino
 * primeiro, que é o que a redação quase sempre quer.
 */
export function templatesFor<T extends TemplateChoice>(
	destination: SocialDestination,
	templates: readonly T[],
): T[] {
	return templates
		.filter(
			(template) =>
				!template.archived && formatServes(template.format, destination),
		)
		.sort((a, b) => {
			const aDefault = a.defaultFor.includes(destination) ? 0 : 1;
			const bDefault = b.defaultFor.includes(destination) ? 0 : 1;
			return aDefault - bDefault || a.name.localeCompare(b.name);
		});
}

export type ArtTextField = {
	layerId: string;
	/** Como a caixa se chama na tela. */
	label: string;
	/** O que está no campo: o texto trocado, ou o que viria da matéria. */
	value: string;
	/** O texto da matéria (ou o fixo do padrão) — o que volta ao apagar a troca. */
	original: string;
	/** A caixa tem texto trocado neste post? */
	overridden: boolean;
};

const FIELD_LABEL: Record<TextLayer["source"], string> = {
	HEADLINE: "Título na arte",
	KICKER: "Chapéu na arte",
	SECTION: "Editoria na arte",
	STATIC: "Texto fixo",
};

/**
 * Um campo por caixa de texto da arte, na ordem da pilha.
 *
 * O texto é mostrado SEM a caixa-alta do padrão: quem edita escreve
 * "Estudantes premiados", e o padrão desenha "ESTUDANTES PREMIADOS". Mostrar em
 * caixa-alta faria a pessoa digitar em caixa-alta — e o texto trocado ficaria
 * gritando no dia em que o padrão deixasse de usar caixa-alta.
 */
export function artTextFields(
	selection: ArtSelection,
	content: ArtContent,
): ArtTextField[] {
	return selection.layers
		.filter((layer): layer is TextLayer => layer.kind === "TEXT")
		.map((layer) => {
			const plain = withoutUppercase(layer);
			const original = textForLayer(plain, content);
			const override = selection.overrides[layer.id];
			return {
				layerId: layer.id,
				label: FIELD_LABEL[layer.source],
				value: override ?? original,
				original,
				overridden: override !== undefined,
			};
		});
}

function withoutUppercase(layer: TextLayer): TextLayer {
	return { ...layer, style: { ...layer.style, uppercase: false } };
}

/**
 * Os textos trocados depois de editar um campo.
 *
 * Voltar ao texto da matéria APAGA a troca, em vez de guardá-la igual: senão o
 * post deixaria de acompanhar a matéria sem ninguém ter decidido isso — a
 * matéria corrigida depois e a arte presa no texto antigo.
 */
export function overridesAfterEdit(
	selection: ArtSelection,
	content: ArtContent,
	layerId: string,
	value: string,
): TextOverrides {
	const field = artTextFields(selection, content).find(
		(item) => item.layerId === layerId,
	);
	const { [layerId]: _previous, ...rest } = selection.overrides;
	if (!field || value.trim() === field.original.trim()) {
		return rest;
	}
	return { ...rest, [layerId]: value };
}

/** O pedido de prévia da arte de um destino — o mesmo desenho que vai ao ar. */
export function artPreviewInput(input: {
	selection: ArtSelection;
	content: ArtContent;
	photoMediaId: string | null;
	width?: number;
}): {
	name: string;
	format: ArtFormat;
	layers: TemplateLayer[];
	content: ArtContent;
	overrides: TextOverrides;
	photoMediaId: string | null;
	width: number;
} {
	return {
		name: input.selection.templateName,
		format: input.selection.format,
		layers: [...input.selection.layers],
		content: input.content,
		overrides: { ...input.selection.overrides },
		photoMediaId: input.photoMediaId,
		width: input.width ?? 360,
	};
}
