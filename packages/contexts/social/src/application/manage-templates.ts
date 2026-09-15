import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import { ArtTemplateNotFound } from "../domain/errors";
import type { SocialDestination } from "../domain/platform";
import type {
	ArtTemplateFilter,
	ArtTemplateRepository,
} from "../domain/ports/art-template-repository";
import {
	type ArtDesign,
	type ArtFormat,
	ArtTemplate,
	InvalidArtTemplate,
	TEMPLATE_NAME_MAX,
} from "../domain/template/art-template";

/**
 * Casos de uso dos padrões de arte (spec 09). Orquestram sem regra: a regra do
 * desenho vive no agregado `ArtTemplate`.
 *
 * **Duas permissões, como nas contas.** Escolher um padrão ao montar o post é
 * ato EDITORIAL (`social:publish`, o editor tem). Criar e mudar um padrão é
 * mexer na identidade visual do veículo — decide o que TODO post vai parecer —
 * e fica com quem gerencia as redes (`social:manage`).
 */
export type TemplateDeps = {
	templates: ArtTemplateRepository;
	clock: Clock;
	ids: IdGenerator;
};

const canChoose = (actor: StaffMember) => can(actor, "social:publish");
const canDesign = (actor: StaffMember) => can(actor, "social:manage");

export async function listTemplates(
	actor: StaffMember,
	filter: ArtTemplateFilter,
	deps: Pick<TemplateDeps, "templates">,
): Promise<Result<readonly ArtTemplate[], Forbidden>> {
	if (!canChoose(actor)) {
		return err(new Forbidden());
	}
	return ok(await deps.templates.list(filter));
}

export async function getTemplate(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<TemplateDeps, "templates">,
): Promise<Result<ArtTemplate, Forbidden | ArtTemplateNotFound>> {
	if (!canChoose(actor)) {
		return err(new Forbidden());
	}
	const template = await deps.templates.findById(input.id);
	return template ? ok(template) : err(new ArtTemplateNotFound(input.id));
}

export async function createTemplate(
	actor: StaffMember,
	input: {
		name: string;
		format: ArtFormat;
		design?: ArtDesign;
	},
	deps: TemplateDeps,
): Promise<Result<ArtTemplate, Forbidden | InvalidArtTemplate>> {
	if (!canDesign(actor)) {
		return err(new Forbidden());
	}
	const created = ArtTemplate.create({
		id: deps.ids.generate(),
		name: input.name,
		format: input.format,
		design: input.design,
		createdAt: deps.clock.now(),
	});
	if (created.isErr()) {
		return err(created.error);
	}
	await deps.templates.save(created.value);
	return ok(created.value);
}

export async function updateTemplate(
	actor: StaffMember,
	input: {
		id: string;
		name?: string;
		format?: ArtFormat;
		design?: ArtDesign;
	},
	deps: Pick<TemplateDeps, "templates" | "clock">,
): Promise<
	Result<ArtTemplate, Forbidden | ArtTemplateNotFound | InvalidArtTemplate>
> {
	if (!canDesign(actor)) {
		return err(new Forbidden());
	}
	const template = await deps.templates.findById(input.id);
	if (!template) {
		return err(new ArtTemplateNotFound(input.id));
	}
	if (template.archived) {
		return err(archivedProblem());
	}
	const updated = template.update(input, deps.clock.now());
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.templates.save(template);
	return ok(template);
}

/**
 * Copia um padrão num novo, na versão 1 e sem ser padrão de nada.
 *
 * É o caminho para a variação ("o mesmo, em 9:16 para os Stories") e para
 * voltar a usar um arquivado sem desarquivá-lo — que mudaria, de novo, o
 * desenho que posts antigos viram.
 */
export async function duplicateTemplate(
	actor: StaffMember,
	input: { id: string; name?: string },
	deps: TemplateDeps,
): Promise<
	Result<ArtTemplate, Forbidden | ArtTemplateNotFound | InvalidArtTemplate>
> {
	if (!canDesign(actor)) {
		return err(new Forbidden());
	}
	const source = await deps.templates.findById(input.id);
	if (!source) {
		return err(new ArtTemplateNotFound(input.id));
	}
	const copy = ArtTemplate.create({
		id: deps.ids.generate(),
		name: input.name ?? copyName(source.name),
		format: source.format,
		design: source.design,
		createdAt: deps.clock.now(),
	});
	if (copy.isErr()) {
		return err(copy.error);
	}
	await deps.templates.save(copy.value);
	return ok(copy.value);
}

/**
 * Define de que destinos o padrão é o padrão — e **desmarca quem era antes**
 * (spec 09, D10), na mesma gravação.
 *
 * Varre todos os ativos, e não só "o padrão atual" de cada destino: se algum
 * dia houver dois marcados (dado antigo, gravação manual), esta chamada é o
 * que conserta, em vez de desmarcar um e deixar o outro.
 */
export async function setTemplateDefaults(
	actor: StaffMember,
	input: { id: string; destinations: readonly SocialDestination[] },
	deps: Pick<TemplateDeps, "templates" | "clock">,
): Promise<
	Result<ArtTemplate, Forbidden | ArtTemplateNotFound | InvalidArtTemplate>
> {
	if (!canDesign(actor)) {
		return err(new Forbidden());
	}
	const template = await deps.templates.findById(input.id);
	if (!template) {
		return err(new ArtTemplateNotFound(input.id));
	}
	if (template.archived) {
		return err(archivedProblem());
	}
	const now = deps.clock.now();
	const marked = template.setDefaultFor(input.destinations, now);
	if (marked.isErr()) {
		return err(marked.error);
	}

	const displaced: ArtTemplate[] = [];
	for (const other of await deps.templates.list({})) {
		if (other.id === template.id) {
			continue;
		}
		const kept = other.defaultFor.filter(
			(destination) => !template.defaultFor.includes(destination),
		);
		if (kept.length !== other.defaultFor.length) {
			// Tirar destinos nunca invalida: o que sobra já era compatível.
			other.setDefaultFor(kept, now);
			displaced.push(other);
		}
	}

	await deps.templates.saveAll([template, ...displaced]);
	return ok(template);
}

export async function archiveTemplate(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<TemplateDeps, "templates" | "clock">,
): Promise<Result<ArtTemplate, Forbidden | ArtTemplateNotFound>> {
	if (!canDesign(actor)) {
		return err(new Forbidden());
	}
	const template = await deps.templates.findById(input.id);
	if (!template) {
		return err(new ArtTemplateNotFound(input.id));
	}
	template.archive(deps.clock.now());
	await deps.templates.save(template);
	return ok(template);
}

/**
 * O padrão de um destino — o que o post automático veste (spec 09, D2). Sem
 * ator: quem chama é o gatilho da matéria publicada, não uma pessoa.
 */
export function defaultTemplateFor(
	destination: SocialDestination,
	deps: Pick<TemplateDeps, "templates">,
): Promise<ArtTemplate | null> {
	return deps.templates.findDefaultFor(destination);
}

function archivedProblem(): InvalidArtTemplate {
	return new InvalidArtTemplate([
		"Este padrão está arquivado. Duplique-o para criar um novo a partir dele.",
	]);
}

function copyName(name: string): string {
	const suffix = " (cópia)";
	const room = TEMPLATE_NAME_MAX - [...suffix].length;
	return `${[...name].slice(0, room).join("")}${suffix}`;
}
