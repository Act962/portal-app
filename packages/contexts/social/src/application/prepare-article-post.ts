import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import {
	DEFAULT_CAPTION_TEMPLATE,
	renderCaption,
} from "../domain/caption-template";
import {
	ArticleNotPublished,
	ArtTemplateNotFound,
	type CaptionRequired,
	InvalidArtChoice,
	type InvalidMediaSelection,
	type InvalidPostTransition,
	type PostNotReady,
} from "../domain/errors";
import {
	DESTINATION_FORMAT,
	DESTINATION_LABEL,
	type SocialDestination,
} from "../domain/platform";
import type { ArtTemplateRepository } from "../domain/ports/art-template-repository";
import type { SocialPostRepository } from "../domain/ports/social-post-repository";
import { type ArtSelections, SocialPost } from "../domain/social-post";
import { selectionFrom } from "../domain/template/art-selection";
import { formatServes } from "../domain/template/art-template";
import type { PublishedArticle } from "./draft-from-article";

export type PrepareArticlePostDeps = {
	repo: SocialPostRepository;
	templates: Pick<ArtTemplateRepository, "findById" | "findDefaultFor">;
	clock: Clock;
	ids: IdGenerator;
	/** O modelo da legenda, como no gatilho automático. */
	captionTemplate?: string;
};

export type PrepareArticlePostInput = {
	article: PublishedArticle;
	/** A matéria já está no ar? Aprovar só vale se estiver. */
	articlePublished: boolean;
	destinations: readonly SocialDestination[];
	/**
	 * O padrão de cada destino: um id; `null` para "sem padrão" (fotos
	 * cortadas); ausente para o padrão do destino, se houver.
	 */
	templates?: Partial<Record<SocialDestination, string | null>>;
	/** Aprovar já, ou deixar como rascunho na fila. */
	approve: boolean;
};

export type PrepareArticlePostError =
	| Forbidden
	| ArticleNotPublished
	| ArtTemplateNotFound
	| InvalidArtChoice
	| InvalidPostTransition
	| PostNotReady
	| CaptionRequired
	| InvalidMediaSelection;

/**
 * Prepara, no editor da MATÉRIA, a publicação dela nas redes (spec 09, F6):
 * destinos (feed e/ou Stories), o padrão de cada um, e rascunho ou aprovado.
 *
 * **Um post por matéria.** Se a matéria já tem o seu post — o rascunho que o
 * gatilho criou, ou um preparado antes aqui mesmo —, é ESSE que se ajusta. A
 * legenda e as fotos que alguém possa ter mexido na fila ficam; mudam os
 * destinos e a arte. Um segundo post para a mesma notícia é o que a trava do
 * gatilho existe para impedir, e esta porta não pode furá-la.
 *
 * **Aprovar só com a matéria no ar** (`ArticleNotPublished`): antes da
 * publicação, o link não existe, e o Facebook receberia um endereço morto.
 */
export async function prepareArticlePost(
	actor: StaffMember,
	input: PrepareArticlePostInput,
	deps: PrepareArticlePostDeps,
): Promise<Result<SocialPost, PrepareArticlePostError>> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	if (input.approve && !input.articlePublished) {
		return err(new ArticleNotPublished());
	}

	const art = await resolveArt(input, deps);
	if (art.isErr()) {
		return err(art.error);
	}

	const existing = await deps.repo.findForArticle(input.article.id);
	let post: SocialPost;
	if (existing) {
		const edited = existing.edit({ platforms: input.destinations });
		if (edited.isErr()) {
			return err(edited.error);
		}
		for (const destination of existing.targets) {
			const chosen = existing.chooseArt(
				destination,
				art.value[destination] ?? null,
			);
			if (chosen.isErr()) {
				return err(chosen.error);
			}
		}
		post = existing;
	} else {
		const created = SocialPost.draft({
			id: deps.ids.generate(),
			articleId: input.article.id,
			origin: "MATERIA",
			captionText: renderCaption(
				deps.captionTemplate ?? DEFAULT_CAPTION_TEMPLATE,
				input.article,
			),
			mediaIds: input.article.coverMediaId ? [input.article.coverMediaId] : [],
			linkUrl: input.article.url,
			platforms: input.destinations,
			art: art.value,
			artContent: {
				headline: input.article.headline,
				kicker: input.article.kicker?.trim()
					? input.article.kicker.trim()
					: null,
				sectionName: input.article.sectionName,
			},
			createdAt: deps.clock.now(),
		});
		if (created.isErr()) {
			return err(created.error);
		}
		post = created.value;
	}

	if (input.approve) {
		const approved = post.approve(actor.id, deps.clock.now());
		if (approved.isErr()) {
			return err(approved.error);
		}
	}

	await deps.repo.save(post);
	return ok(post);
}

/**
 * A arte de cada destino. O padrão do destino entra calado (já é compatível —
 * a regra de padrão de destino garante). O escolhido por uma pessoa é
 * conferido e recusado dizendo por quê: inexistente, arquivado ou de um formato
 * que o destino não aceita.
 */
async function resolveArt(
	input: PrepareArticlePostInput,
	deps: Pick<PrepareArticlePostDeps, "templates">,
): Promise<Result<ArtSelections, ArtTemplateNotFound | InvalidArtChoice>> {
	const art: ArtSelections = {};
	for (const destination of new Set(input.destinations)) {
		const choice = input.templates?.[destination];
		if (choice === null) {
			continue;
		}
		if (choice === undefined) {
			const fallback = await deps.templates.findDefaultFor(destination);
			if (fallback) {
				art[destination] = selectionFrom(fallback);
			}
			continue;
		}
		const template = await deps.templates.findById(choice);
		if (!template) {
			return err(new ArtTemplateNotFound(choice));
		}
		const label = DESTINATION_LABEL[destination];
		if (template.archived) {
			return err(
				new InvalidArtChoice(
					`O padrão "${template.name}" está arquivado. Escolha outro para ${label}.`,
				),
			);
		}
		if (!formatServes(template.format, destination)) {
			const expected =
				DESTINATION_FORMAT[destination] === "STORY" ? "9:16" : "1:1 ou 4:5";
			return err(
				new InvalidArtChoice(
					`O padrão "${template.name}" é ${template.format}, e ${label} pede ${expected}.`,
				),
			);
		}
		art[destination] = selectionFrom(template);
	}
	return ok(art);
}
