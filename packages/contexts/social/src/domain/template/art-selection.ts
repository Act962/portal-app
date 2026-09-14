import type { SocialDestination } from "../platform";
import {
	type ArtFormat,
	ArtTemplate,
	formatServes,
	type TemplateLayer,
} from "./art-template";
import type { TextOverrides } from "./fit-text";

/**
 * A arte escolhida para UM destino de um post (spec 09, F5).
 *
 * **Guarda uma cópia do desenho, e não só o id do padrão.** O repositório de
 * padrões não tem histórico de versões: ele guarda o padrão como está agora. Se
 * o post apontasse só para o id, editar o padrão amanhã mudaria a arte de um
 * post aprovado hoje — exatamente o que o D9 proíbe. Com a cópia, o que foi
 * visto e aprovado é o que vai ao ar, mesmo que o padrão mude ou seja
 * arquivado no meio do caminho.
 *
 * O id e a versão ficam junto só para a tela dizer de onde veio o desenho
 * ("Últimas — feed, versão 3") e oferecer atualizar para a versão nova.
 */
export type ArtSelection = {
	templateId: string;
	templateName: string;
	/** A versão do padrão no momento da escolha. */
	version: number;
	format: ArtFormat;
	layers: readonly TemplateLayer[];
	/** O texto trocado NESTE post, por id da camada (`textForLayer`). */
	overrides: TextOverrides;
};

/** A escolha a partir do padrão como ele está agora. */
export function selectionFrom(
	template: ArtTemplate,
	overrides: TextOverrides = {},
): ArtSelection {
	return {
		templateId: template.id,
		templateName: template.name,
		version: template.version,
		format: template.format,
		layers: [...template.layers],
		overrides: { ...overrides },
	};
}

/**
 * A cópia de volta como padrão, para o desenhista. `restore`, e não `create`:
 * a cópia já foi validada quando o padrão foi salvo, e revalidar aqui poderia
 * recusar um desenho aprovado só porque uma regra mudou depois.
 */
export function selectionAsTemplate(selection: ArtSelection): ArtTemplate {
	return ArtTemplate.restore({
		id: selection.templateId,
		name: selection.templateName,
		format: selection.format,
		layers: selection.layers,
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
 * A mesma escolha com os textos trocados — só das camadas de texto que o
 * desenho tem. Um override de camada que não existe mais (o padrão foi
 * atualizado e a caixa sumiu) é descartado, em vez de ficar guardado sem uso.
 */
export function withOverrides(
	selection: ArtSelection,
	overrides: TextOverrides,
): ArtSelection {
	const textIds = new Set(
		selection.layers
			.filter((layer) => layer.kind === "TEXT")
			.map((layer) => layer.id),
	);
	return {
		...selection,
		overrides: Object.fromEntries(
			Object.entries(overrides).filter(([id]) => textIds.has(id)),
		),
	};
}
