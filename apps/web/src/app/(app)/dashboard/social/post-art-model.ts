import {
	type ArtFormat,
	formatServes,
	type SocialDestination,
} from "@portal-app/social";

/**
 * A lógica de escolha de padrão da seção "Arte" do post, SEM JSX e SEM React
 * (regra de testes do projeto). Os campos a preencher e o que guardar ao editar
 * vêm do domínio (`artFields`, `inputsAfter*`) — a tela não repete regra.
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
