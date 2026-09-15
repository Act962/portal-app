import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Page,
	type PageRequest,
	type Result,
} from "@portal-app/shared-kernel";

import type { CaptionRequired } from "../domain/errors";
import {
	ArtTemplateNotFound,
	InvalidArtChoice,
	type InvalidDeliveryTransition,
	type InvalidMediaSelection,
	type InvalidPostTransition,
	type PostNotReady,
	SocialPostNotFound,
} from "../domain/errors";
import type { SocialDestination } from "../domain/platform";
import type { ArtTemplateRepository } from "../domain/ports/art-template-repository";
import type {
	SocialPostFilter,
	SocialPostRepository,
} from "../domain/ports/social-post-repository";
import { type DeliveryModes, SocialPost } from "../domain/social-post";
import {
	type ArtSelection,
	selectionFrom,
} from "../domain/template/art-selection";
import type { ArtContent, ArtInputs } from "../domain/template/variables";

/**
 * Casos de uso da fila de publicação. Orquestram sem regra: a regra vive no
 * agregado `SocialPost`.
 *
 * A autorização é `social:publish`, que o EDITOR tem (spec 08, D11) — aprovar o
 * post é a mesma decisão editorial de publicar a matéria, tomada de novo em
 * outra vitrine. Conectar conta é outra ação, com outro dono.
 */
export type PostDeps = {
	repo: SocialPostRepository;
	clock: Clock;
	ids: IdGenerator;
};

export type DraftInput = {
	captionText: string;
	mediaIds: readonly string[];
	/** Os destinos: o feed de cada rede e/ou os Stories do Instagram. */
	platforms: readonly SocialDestination[];
	/** Quem publica cada destino; o que falta usa o padrão (spec 11, D2). */
	modes?: DeliveryModes;
	linkUrl?: string | null;
	articleId?: string | null;
};

type DraftError = Forbidden | CaptionRequired | InvalidMediaSelection;

export async function createDraft(
	actor: StaffMember,
	input: DraftInput,
	deps: PostDeps,
): Promise<Result<SocialPost, DraftError>> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = SocialPost.draft({
		...input,
		id: deps.ids.generate(),
		// MANUAL: quem cria por esta porta é uma pessoa na tela. O automático
		// entra por `draftPostForArticle`, e a diferença ordena a fila.
		origin: "MANUAL",
		createdAt: deps.clock.now(),
	});
	if (post.isErr()) {
		return err(post.error);
	}
	await deps.repo.save(post.value);
	return ok(post.value);
}

export async function updatePost(
	actor: StaffMember,
	input: Partial<DraftInput> & { id: string },
	deps: Pick<PostDeps, "repo">,
): Promise<
	Result<SocialPost, DraftError | SocialPostNotFound | InvalidPostTransition>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const edited = post.edit(input);
	if (edited.isErr()) {
		return err(edited.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

/**
 * Aprova e entrega o post à fila de envio.
 *
 * **Não chama a Meta.** Tranca o post e devolve; quem fala com a rede é a
 * tarefa `publishPendingPosts`, dirigida pelo agendador. Chamada de rede dentro
 * da requisição HTTP do painel é o caminho curto para um timeout com o post em
 * estado indefinido — e, no Instagram, um post publicado que o sistema acha que
 * falhou.
 */
export async function approvePost(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<PostDeps, "repo" | "clock">,
): Promise<
	Result<
		SocialPost,
		Forbidden | SocialPostNotFound | PostNotReady | InvalidPostTransition
	>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const approved = post.approve(actor.id, deps.clock.now());
	if (approved.isErr()) {
		return err(approved.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

/** Recoloca na fila só as entregas que falharam. */
export async function retryPost(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<PostDeps, "repo">,
): Promise<
	Result<SocialPost, Forbidden | SocialPostNotFound | InvalidPostTransition>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const retried = post.retryFailed();
	if (retried.isErr()) {
		return err(retried.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

export async function cancelPost(
	actor: StaffMember,
	input: { id: string },
	deps: Pick<PostDeps, "repo">,
): Promise<
	Result<SocialPost, Forbidden | SocialPostNotFound | InvalidPostTransition>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const cancelled = post.cancel();
	if (cancelled.isErr()) {
		return err(cancelled.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

export function listQueue(
	filter: SocialPostFilter,
	page: PageRequest,
	deps: Pick<PostDeps, "repo">,
): Promise<Page<SocialPost>> {
	return deps.repo.list(filter, page);
}

export function getPost(
	id: string,
	deps: Pick<PostDeps, "repo">,
): Promise<SocialPost | null> {
	return deps.repo.findById(id);
}

// ── publicação manual (spec 11) ─────────────────────────────────────────────

type DeliveryInput = { id: string; destination: SocialDestination };

type DeliveryResult = Promise<
	Result<SocialPost, Forbidden | SocialPostNotFound | InvalidDeliveryTransition>
>;

/**
 * Carrega o post, aplica a mudança numa entrega e grava. As três operações da
 * publicação manual têm a mesma forma e a mesma permissão (D12): publicar à mão
 * é publicar, só que por outro caminho.
 */
async function changeDelivery(
	actor: StaffMember,
	id: string,
	repo: SocialPostRepository,
	change: (post: SocialPost) => Result<void, InvalidDeliveryTransition>,
): DeliveryResult {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await repo.findById(id);
	if (!post) {
		return err(new SocialPostNotFound(id));
	}
	const changed = change(post);
	if (changed.isErr()) {
		return err(changed.error);
	}
	await repo.save(post);
	return ok(post);
}

/** "Já publiquei" — a pessoa publicou o story pelo app (D7). */
export function confirmManualPublish(
	actor: StaffMember,
	input: DeliveryInput & { permalink?: string | null },
	deps: Pick<PostDeps, "repo" | "clock">,
): DeliveryResult {
	return changeDelivery(actor, input.id, deps.repo, (post) =>
		post.confirmManualPublish(
			input.destination,
			actor.id,
			input.permalink?.trim() || null,
			deps.clock.now(),
		),
	);
}

/** "Não vou publicar" (D3). */
export function dismissDelivery(
	actor: StaffMember,
	input: DeliveryInput,
	deps: Pick<PostDeps, "repo" | "clock">,
): DeliveryResult {
	return changeDelivery(actor, input.id, deps.repo, (post) =>
		post.dismissDelivery(input.destination, actor.id, deps.clock.now()),
	);
}

/** A entrega automática falhou; vai à mão (D8). O worker prepara a arte. */
export function publishDeliveryManually(
	actor: StaffMember,
	input: DeliveryInput,
	deps: Pick<PostDeps, "repo">,
): DeliveryResult {
	return changeDelivery(actor, input.id, deps.repo, (post) =>
		post.publishManually(input.destination),
	);
}

/**
 * O número do badge na navegação: o que espera aprovação e o que espera alguém
 * publicar à mão (spec 11, D9) — os dois são trabalho parado numa pessoa.
 */
export function countPendingPosts(
	deps: Pick<PostDeps, "repo">,
): Promise<number> {
	return deps.repo.countPending();
}

// ── arte do post (spec 09, F5) ──────────────────────────────────────────────

export type PostArtDeps = {
	repo: SocialPostRepository;
	templates: Pick<ArtTemplateRepository, "findById">;
};

/**
 * Escolhe o padrão da arte de um destino do post — ou tira, com
 * `templateId: null`.
 *
 * Guarda a CÓPIA do padrão como ele está AGORA (D9): editar o padrão depois não
 * muda este post. Escolher de novo o mesmo padrão é o jeito de trazer a versão
 * nova para um rascunho.
 *
 * Mesma permissão de aprovar (`social:publish`): escolher a arte do post é
 * decisão editorial; desenhar o padrão é que é gestão.
 */
export async function choosePostArt(
	actor: StaffMember,
	input: {
		id: string;
		destination: SocialDestination;
		templateId: string | null;
		values?: ArtInputs["values"];
		texts?: ArtInputs["texts"];
	},
	deps: PostArtDeps,
): Promise<
	Result<
		SocialPost,
		| Forbidden
		| SocialPostNotFound
		| ArtTemplateNotFound
		| InvalidArtChoice
		| InvalidPostTransition
	>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	let selection: ArtSelection | null = null;
	if (input.templateId !== null) {
		const template = await deps.templates.findById(input.templateId);
		if (!template) {
			return err(new ArtTemplateNotFound(input.templateId));
		}
		if (template.archived) {
			return err(
				new InvalidArtChoice(
					`O padrão "${template.name}" está arquivado. Escolha outro.`,
				),
			);
		}
		selection = selectionFrom(template, {
			values: input.values ?? {},
			texts: input.texts ?? {},
		});
	}
	const chosen = post.chooseArt(input.destination, selection);
	if (chosen.isErr()) {
		return err(chosen.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

/**
 * Troca só o que a redação PREENCHE na arte de um destino — as variáveis do
 * padrão e as caixas Editáveis (spec 10, D3) —, mantendo a cópia do desenho: é
 * o "corrigir o título que vai na arte" sem trazer junto uma versão nova do
 * padrão que ninguém pediu.
 */
export async function setPostArtInputs(
	actor: StaffMember,
	input: {
		id: string;
		destination: SocialDestination;
	} & ArtInputs,
	deps: Pick<PostArtDeps, "repo">,
): Promise<
	Result<
		SocialPost,
		Forbidden | SocialPostNotFound | InvalidArtChoice | InvalidPostTransition
	>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const current = post.artFor(input.destination);
	if (!current) {
		return err(
			new InvalidArtChoice("Este destino ainda não tem um padrão escolhido."),
		);
	}
	const chosen = post.chooseArt(input.destination, {
		...current,
		values: input.values,
		texts: input.texts,
	});
	if (chosen.isErr()) {
		return err(chosen.error);
	}
	await deps.repo.save(post);
	return ok(post);
}

/** Troca o que preenche as caixas da arte (título, chapéu, editoria). */
export async function setPostArtContent(
	actor: StaffMember,
	input: { id: string; content: ArtContent },
	deps: Pick<PostArtDeps, "repo">,
): Promise<
	Result<SocialPost, Forbidden | SocialPostNotFound | InvalidPostTransition>
> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const post = await deps.repo.findById(input.id);
	if (!post) {
		return err(new SocialPostNotFound(input.id));
	}
	const changed = post.setArtContent(input.content);
	if (changed.isErr()) {
		return err(changed.error);
	}
	await deps.repo.save(post);
	return ok(post);
}
