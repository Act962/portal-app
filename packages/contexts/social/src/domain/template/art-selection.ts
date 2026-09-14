import type { SocialDestination } from "../platform";
import {
	type ArtDesign,
	type ArtFormat,
	ArtTemplate,
	formatServes,
} from "./art-template";
import { type ArtInputs, NO_INPUTS } from "./variables";

/**
 * A arte escolhida para UM destino de um post (spec 09, F5; spec 10, §4).
 *
 * **Guarda uma cópia do desenho, e não só o id do padrão.** O repositório de
 * padrões guarda o padrão como está agora; se o post apontasse só para o id,
 * editar o padrão amanhã mudaria a arte de um post aprovado hoje (09, D9).
 */
export type ArtSelection = {
	templateId: string;
	templateName: string;
	/** A versão do padrão no momento da escolha. */
	version: number;
	format: ArtFormat;
	design: ArtDesign;
} & ArtInputs;

/** A escolha a partir do padrão como ele está agora. */
export function selectionFrom(
	template: ArtTemplate,
	inputs: Partial<ArtInputs> = {},
): ArtSelection {
	return withInputs(
		{
			templateId: template.id,
			templateName: template.name,
			version: template.version,
			format: template.format,
			design: template.design,
			...NO_INPUTS,
		},
		{ ...NO_INPUTS, ...inputs },
	);
}

/**
 * A cópia de volta como padrão. `restore`, e não `create`: a cópia já foi
 * validada quando o padrão foi salvo, e revalidar poderia recusar um desenho
 * aprovado só porque uma regra mudou depois.
 */
export function selectionAsTemplate(selection: ArtSelection): ArtTemplate {
	return ArtTemplate.restore({
		id: selection.templateId,
		name: selection.templateName,
		format: selection.format,
		design: selection.design,
		defaultFor: [],
		version: selection.version,
		archived: false,
		createdAt: new Date(0),
		updatedAt: new Date(0),
	});
}

/** A escolha serve a este destino? Story pede 9:16; feed, 1:1 ou 4:5. */
export function selectionServes(
	selection: ArtSelection,
	destination: SocialDestination,
): boolean {
	return formatServes(selection.format, destination);
}

/**
 * A mesma escolha com o que a redação preencheu — só das variáveis que o
 * padrão declara e das caixas que são Editáveis. O resto (variável que o padrão
 * novo não tem mais, caixa que virou Dinâmica) é descartado em vez de ficar
 * guardado sem uso.
 */
export function withInputs(
	selection: ArtSelection,
	inputs: ArtInputs,
): ArtSelection {
	const keys = new Set(
		selection.design.variables.map((variable) => variable.key),
	);
	const editable = new Set(
		selection.design.elements
			.filter(
				(element) => element.kind === "TEXT" && element.mode === "EDITABLE",
			)
			.map((element) => element.id),
	);
	return {
		...selection,
		values: Object.fromEntries(
			Object.entries(inputs.values).filter(([key]) => keys.has(key)),
		),
		texts: Object.fromEntries(
			Object.entries(inputs.texts).filter(([id]) => editable.has(id)),
		),
	};
}
