import {
	can,
	Forbidden,
	type ResourceRef,
	type StaffMember,
} from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Page,
	type PageRequest,
	type Result,
} from "@portal-app/shared-kernel";

import { Article } from "../domain/article";
import type { BlockInput } from "../domain/body";
import {
	ArticleNotFound,
	type ArticleOnAir,
	type BylineRequired,
	type HeadlineRequired,
	type InvalidBlock,
	type InvalidSlug,
	type InvalidTransition,
	type PublishBlocker,
	type RejectionReasonRequired,
	type ScheduleInPast,
	type SlugImmutable,
} from "../domain/errors";
import type {
	ArticleFilter,
	ArticleRepository,
} from "../domain/ports/article-repository";

/**
 * Casos de uso do workflow editorial. Orquestram sem regra: a regra vive no
 * agregado. A AUTORIZAÇÃO é feita aqui com `can(actor, ação, recurso)` do
 * identity (architecture.md §5) — o editor age só nas editorias vinculadas, o
 * redator só na própria matéria. O "agora" vem da porta `Clock` (testável).
 */
export type Deps = {
	repo: ArticleRepository;
	clock: Clock;
	ids: IdGenerator;
};

function refOf(article: Article): ResourceRef {
	return {
		authorId: article.byline.authorId,
		sectionId: article.sectionId ?? undefined,
	};
}

export async function createDraft(
	actor: StaffMember,
	input: {
		headline: string;
		authorName: string;
		slug?: string;
		kicker?: string | null;
		standfirst?: string | null;
		sectionId?: string | null;
		tagIds?: readonly string[];
		body?: readonly BlockInput[];
		cover?: { mediaId: string; altText?: string | null } | null;
	},
	deps: Deps,
): Promise<
	Result<
		Article,
		Forbidden | HeadlineRequired | InvalidSlug | BylineRequired | InvalidBlock
	>
> {
	if (!can(actor, "article:create")) {
		return err(new Forbidden());
	}
	const draft = Article.createDraft({
		id: deps.ids.generate(),
		headline: input.headline,
		slug: input.slug,
		byline: { authorId: actor.id, name: input.authorName },
		kicker: input.kicker,
		standfirst: input.standfirst,
		sectionId: input.sectionId,
		tagIds: input.tagIds,
		body: input.body,
		cover: input.cover,
	});
	if (draft.isErr()) {
		return err(draft.error);
	}
	await deps.repo.save(draft.value);
	return ok(draft.value);
}

/** Editar exige ser o autor (edit-own) ou editor/admin da editoria (edit-any). */
export async function updateArticle(
	actor: StaffMember,
	input: {
		id: string;
		headline?: string;
		kicker?: string | null;
		standfirst?: string | null;
		sectionId?: string | null;
		tagIds?: readonly string[];
		body?: readonly BlockInput[];
		cover?: { mediaId: string; altText?: string | null } | null;
		authorName?: string;
	},
	deps: Deps,
): Promise<
	Result<
		Article,
		| Forbidden
		| ArticleNotFound
		| InvalidTransition
		| HeadlineRequired
		| InvalidBlock
		| BylineRequired
	>
> {
	const article = await deps.repo.findById(input.id);
	if (!article) {
		return err(new ArticleNotFound(input.id));
	}
	const ref = refOf(article);
	if (
		!can(actor, "article:edit-any", ref) &&
		!can(actor, "article:edit-own", ref)
	) {
		return err(new Forbidden());
	}
	const edited = article.editContent(input);
	if (edited.isErr()) {
		return err(edited.error);
	}
	// Editar matéria já publicada a leva a ATUALIZADA (emite ArticleUpdated).
	if (article.isPublished()) {
		article.markUpdated(deps.clock.now());
	}
	await deps.repo.save(article);
	return ok(article);
}

export async function changeSlug(
	actor: StaffMember,
	input: { id: string; slug: string },
	deps: Deps,
): Promise<
	Result<Article, Forbidden | ArticleNotFound | InvalidSlug | SlugImmutable>
> {
	const article = await deps.repo.findById(input.id);
	if (!article) {
		return err(new ArticleNotFound(input.id));
	}
	const ref = refOf(article);
	if (
		!can(actor, "article:edit-any", ref) &&
		!can(actor, "article:edit-own", ref)
	) {
		return err(new Forbidden());
	}
	const result = article.changeSlug(input.slug);
	if (result.isErr()) {
		return err(result.error);
	}
	await deps.repo.save(article);
	return ok(article);
}

export function submitForReview(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<Result<Article, Forbidden | ArticleNotFound | InvalidTransition>> {
	return guarded(actor, input.id, deps, "article:submit", (article) =>
		article.submitForReview(deps.clock.now()),
	);
}

export function approve(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<Result<Article, Forbidden | ArticleNotFound | InvalidTransition>> {
	return guarded(actor, input.id, deps, "article:approve", (article) =>
		article.approve(),
	);
}

export function reject(
	actor: StaffMember,
	input: { id: string; reason: string },
	deps: Deps,
): Promise<
	Result<
		Article,
		Forbidden | ArticleNotFound | InvalidTransition | RejectionReasonRequired
	>
> {
	return guarded(actor, input.id, deps, "article:approve", (article) =>
		article.reject(input.reason, deps.clock.now()),
	);
}

export function publish(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<
	Result<
		Article,
		Forbidden | ArticleNotFound | InvalidTransition | PublishBlocker
	>
> {
	return guarded(actor, input.id, deps, "article:publish", (article) =>
		article.publish(deps.clock.now()),
	);
}

export function schedule(
	actor: StaffMember,
	input: { id: string; at: Date },
	deps: Deps,
): Promise<
	Result<
		Article,
		| Forbidden
		| ArticleNotFound
		| InvalidTransition
		| ScheduleInPast
		| PublishBlocker
	>
> {
	return guarded(actor, input.id, deps, "article:publish", (article) =>
		article.schedule(input.at, deps.clock.now()),
	);
}

export function cancelSchedule(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<Result<Article, Forbidden | ArticleNotFound | InvalidTransition>> {
	return guarded(actor, input.id, deps, "article:publish", (article) =>
		article.cancelSchedule(),
	);
}

/**
 * Arquiva. A PERMISSÃO exigida depende de a matéria estar ou não no ar.
 *
 * Não cabe no `guarded`, que recebe uma ação fixa, porque aqui são duas ações
 * diferentes para a mesma transição — e são mesmo duas coisas diferentes:
 * derrubar do portal algo que o público está lendo é decisão de quem responde
 * pela editoria (`article:unpublish`); guardar um rascunho que nunca saiu é
 * parte de escrevê-lo, e cobrar `article:unpublish` para isso deixaria o
 * redator preso ao próprio texto abandonado — o rascunho ainda sem editoria não
 * satisfaz nem a checagem de editoria vinculada do editor.
 */
export async function archive(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<Result<Article, Forbidden | ArticleNotFound | InvalidTransition>> {
	const article = await deps.repo.findById(input.id);
	if (!article) {
		return err(new ArticleNotFound(input.id));
	}
	const ref = refOf(article);
	const allowed = article.isPublished()
		? can(actor, "article:unpublish", ref)
		: can(actor, "article:edit-any", ref) ||
			can(actor, "article:edit-own", ref);
	if (!allowed) {
		return err(new Forbidden());
	}
	const result = article.archive(deps.clock.now());
	if (result.isErr()) {
		return err(result.error);
	}
	await deps.repo.save(article);
	return ok(article);
}

/** O pouco que sobra de uma matéria apagada — o bastante para a tela dizer o
 * que sumiu, já que o agregado não existe mais para ser consultado. */
export type DeletedArticle = { id: string; headline: string; slug: string };

/**
 * Apaga DE VEZ. A única operação do editorial que destrói o agregado.
 *
 * São DUAS permissões, não uma. `article:delete` diz que a pessoa pode agir
 * sobre esta matéria — o redator sobre a própria, o editor sobre a editoria
 * dele. Mas apagar o registro de algo que JÁ ESTEVE NO AR é outra ordem de
 * coisa: aquele endereço foi público, está indexado e linkado, e eliminá-lo é
 * mexer no acervo. Por isso exige também `article:unpublish` — a mesma
 * permissão de tirar do portal. Assim o redator descarta o rascunho dele à
 * vontade e não encosta no que já foi publicado.
 *
 * O que NÃO pode ser apagado em nenhuma hipótese (matéria no ar) é decidido
 * pelo agregado, em `markDeleted`. Autorização responde "quem"; o domínio
 * responde "o quê".
 */
export async function deleteArticle(
	actor: StaffMember,
	input: { id: string },
	deps: Deps,
): Promise<Result<DeletedArticle, Forbidden | ArticleNotFound | ArticleOnAir>> {
	const article = await deps.repo.findById(input.id);
	if (!article) {
		return err(new ArticleNotFound(input.id));
	}
	const ref = refOf(article);
	if (!can(actor, "article:delete", ref)) {
		return err(new Forbidden());
	}
	if (article.wasEverPublished() && !can(actor, "article:unpublish", ref)) {
		return err(new Forbidden());
	}
	const marked = article.markDeleted(deps.clock.now());
	if (marked.isErr()) {
		return err(marked.error);
	}
	// Lido ANTES do delete: depois, o agregado ainda existe em memória, mas
	// perguntar a ele o que acabou de sumir é pedir para alguém confiar num
	// objeto que já não representa nada.
	const summary: DeletedArticle = {
		id: article.id,
		headline: article.headline,
		slug: article.slug,
	};
	await deps.repo.delete(article);
	return ok(summary);
}

/** O que aconteceu com CADA matéria de uma ação em lote. */
export type BulkOutcome = {
	done: string[];
	failed: { id: string; reason: string }[];
};

/**
 * Arquiva várias matérias de uma vez (o seletor da lista).
 *
 * PARCIAL DE PROPÓSITO: cada matéria passa pela MESMA autorização e pela mesma
 * máquina de estados de `archive`, e o que falha não derruba o que deu certo.
 * Uma seleção de dez em que a sétima já fora arquivada por outra pessoa não
 * pode desfazer as seis primeiras — o lote é conveniência de tela, não uma
 * transação de negócio. Quem chama recebe a lista dos dois lados e diz à
 * redação exatamente o que passou e o que ficou.
 *
 * Sequencial, não `Promise.all`: cada `archive` grava agregado + outbox na
 * própria transação, e disparar N escritas concorrentes numa ação de tela só
 * troca latência por contenção no banco.
 */
export function archiveMany(
	actor: StaffMember,
	input: { ids: readonly string[] },
	deps: Deps,
): Promise<BulkOutcome> {
	return runBulk(input.ids, (id) => archive(actor, { id }, deps));
}

/**
 * Apaga a seleção da lista. Mesmíssimo arranjo do `archiveMany` — e aqui a
 * parcialidade importa ainda mais: num lote de dez, uma que voltou ao ar entre
 * a marcação da caixinha e o clique tem de ser recusada SOZINHA, sem levar
 * junto as nove que podiam sumir nem apagar a que não podia.
 */
export function deleteMany(
	actor: StaffMember,
	input: { ids: readonly string[] },
	deps: Deps,
): Promise<BulkOutcome> {
	return runBulk(input.ids, (id) => deleteArticle(actor, { id }, deps));
}

/**
 * O laço dos lotes, um só para arquivar e apagar: sequencial, parcial, e
 * relatando os dois lados. Duas cópias dele acabariam discordando sobre o que
 * fazer com a sétima falha de dez.
 */
async function runBulk(
	ids: readonly string[],
	run: (id: string) => Promise<Result<unknown, Error>>,
): Promise<BulkOutcome> {
	const outcome: BulkOutcome = { done: [], failed: [] };
	for (const id of ids) {
		const result = await run(id);
		if (result.isOk()) {
			outcome.done.push(id);
		} else {
			outcome.failed.push({ id, reason: result.unwrapErr().message });
		}
	}
	return outcome;
}

/**
 * Uma PÁGINA da lista editorial (A10). Devolve o total junto porque a tela
 * precisa dizer "de N" — e porque descobrir que a página pedida não existe só
 * ao receber lista vazia é pior do que saber o total de saída.
 *
 * As duas consultas correm em paralelo: são independentes, e serializá-las
 * dobraria a latência da tela mais usada do painel à toa.
 */
export async function listArticles(
	filter: ArticleFilter,
	deps: Pick<Deps, "repo">,
	page?: PageRequest,
): Promise<Page<Article>> {
	const [items, total] = await Promise.all([
		deps.repo.list(filter, page),
		deps.repo.count(filter),
	]);
	return { items, total };
}

/** Todas as agendadas — alimenta o calendário editorial (A15). */
export function listScheduled(deps: Pick<Deps, "repo">): Promise<Article[]> {
	return deps.repo.list({ status: "AGENDADA" });
}

/**
 * Publica as agendadas cujo horário chegou (A13). É o GATILHO DO RELÓGIO, sem
 * ator humano: quem o dirige é a composição — um `node-cron`, um loop, ou uma
 * função Inngest (§5.1), todos cumprindo o mesmo papel. Determinístico: o "agora"
 * vem da porta `Clock`, então roda com `FixedClock` nos testes, sem espera real.
 * Cada publicação grava `ArticlePublished` no outbox (mesma transação).
 */
export async function publishDueScheduled(
	deps: Pick<Deps, "repo" | "clock">,
): Promise<Article[]> {
	const now = deps.clock.now();
	const due = await deps.repo.listDueScheduled(now);
	const published: Article[] = [];
	for (const article of due) {
		if (article.publish(now).isOk()) {
			await deps.repo.save(article);
			published.push(article);
		}
	}
	return published;
}

export function getArticle(
	id: string,
	deps: Pick<Deps, "repo">,
): Promise<Article | null> {
	return deps.repo.findById(id);
}

/**
 * Padrão comum das transições: carrega, autoriza pela ação sobre o recurso da
 * matéria, aplica a mutação de domínio, persiste. Um único ponto para a
 * checagem de existência e permissão.
 */
async function guarded<E>(
	actor: StaffMember,
	id: string,
	deps: Deps,
	action: Parameters<typeof can>[1],
	mutate: (article: Article) => Result<void, E>,
): Promise<Result<Article, Forbidden | ArticleNotFound | E>> {
	const article = await deps.repo.findById(id);
	if (!article) {
		return err(new ArticleNotFound(id));
	}
	if (!can(actor, action, refOf(article))) {
		return err(new Forbidden());
	}
	const result = mutate(article);
	if (result.isErr()) {
		return err(result.error);
	}
	await deps.repo.save(article);
	return ok(article);
}
