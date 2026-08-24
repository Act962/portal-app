import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { type BlockInput, Body } from "./body";
import { Byline } from "./byline";
import { Cover } from "./cover";
import type { EditorialStatus } from "./editorial-status";
import {
	AltTextRequired,
	BodyRequired,
	type BylineRequired,
	CoverImageRequired,
	type HeadlineRequired,
	type InvalidBlock,
	type InvalidSlug,
	InvalidTransition,
	type PublishBlocker,
	RejectionReasonRequired,
	type ScheduleInPast,
	SectionRequired,
	SlugImmutable,
} from "./errors";
import {
	ArticlePublished,
	ArticleRejected,
	ArticleScheduled,
	ArticleSubmittedForReview,
	ArticleUnpublished,
	ArticleUpdated,
} from "./events";
import { Headline } from "./headline";
import { Kicker, Standfirst } from "./optional-text";
import { PublicationSchedule } from "./publication-schedule";
import { Slug } from "./slug";

type ArticleState = {
	headline: Headline;
	slug: Slug;
	kicker: Kicker;
	standfirst: Standfirst;
	body: Body;
	byline: Byline;
	sectionId: string | null;
	tagIds: readonly string[];
	cover: Cover | null;
	status: EditorialStatus;
	schedule: PublicationSchedule | null;
	publishedAt: Date | null;
	firstPublishedAt: Date | null;
	rejectionReason: string | null;
};

type DraftInput = {
	id: string;
	headline: string;
	slug?: string;
	byline: { authorId: string; name: string };
	kicker?: string | null;
	standfirst?: string | null;
	sectionId?: string | null;
	tagIds?: readonly string[];
	body?: readonly BlockInput[];
	cover?: { mediaId: string; altText?: string | null } | null;
};

type DraftError =
	| HeadlineRequired
	| InvalidSlug
	| BylineRequired
	| InvalidBlock;

/**
 * Article — o agregado raiz do editorial e o core domain do produto. Protege a
 * máquina de estados do workflow e os invariantes de publicação
 * (`architecture.md` §2.1). Toda regra é pura e devolve `Result`; os eventos são
 * acumulados via `record()` e entregues pelo outbox na mesma transação do save.
 */
export class Article extends AggregateRoot<string> {
	private state: ArticleState;

	private constructor(id: string, state: ArticleState) {
		super(id);
		this.state = state;
	}

	static createDraft(input: DraftInput): Result<Article, DraftError> {
		const headline = Headline.create(input.headline);
		if (headline.isErr()) {
			return err(headline.error);
		}

		const slug = Slug.create(input.slug ?? input.headline);
		if (slug.isErr()) {
			return err(slug.error);
		}

		const byline = Byline.create(input.byline);
		if (byline.isErr()) {
			return err(byline.error);
		}

		const body = input.body ? Body.create(input.body) : ok(Body.empty());
		if (body.isErr()) {
			return err(body.error);
		}

		return ok(
			new Article(input.id, {
				headline: headline.value,
				slug: slug.value,
				kicker: Kicker.create(input.kicker),
				standfirst: Standfirst.create(input.standfirst),
				body: body.value,
				byline: byline.value,
				sectionId: input.sectionId ?? null,
				tagIds: input.tagIds ? [...input.tagIds] : [],
				cover: input.cover ? Cover.create(input.cover) : null,
				status: "RASCUNHO",
				schedule: null,
				publishedAt: null,
				firstPublishedAt: null,
				rejectionReason: null,
			}),
		);
	}

	/** Reidrata da persistência. Assume dados válidos; estoura se não forem. */
	static restore(props: {
		id: string;
		headline: string;
		slug: string;
		byline: { authorId: string; name: string };
		kicker?: string | null;
		standfirst?: string | null;
		sectionId?: string | null;
		tagIds?: readonly string[];
		body?: readonly BlockInput[];
		cover?: { mediaId: string; altText?: string | null } | null;
		status: EditorialStatus;
		scheduledAt?: Date | null;
		publishedAt?: Date | null;
		firstPublishedAt?: Date | null;
		rejectionReason?: string | null;
	}): Article {
		const headline = Headline.create(props.headline);
		const slug = Slug.create(props.slug);
		const byline = Byline.create(props.byline);
		const body = props.body ? Body.create(props.body) : ok(Body.empty());
		if (headline.isErr() || slug.isErr() || byline.isErr() || body.isErr()) {
			throw new Error(`Dados persistidos inválidos para o artigo ${props.id}`);
		}
		return new Article(props.id, {
			headline: headline.value,
			slug: slug.value,
			kicker: Kicker.create(props.kicker),
			standfirst: Standfirst.create(props.standfirst),
			body: body.value,
			byline: byline.value,
			sectionId: props.sectionId ?? null,
			tagIds: props.tagIds ? [...props.tagIds] : [],
			cover: props.cover ? Cover.create(props.cover) : null,
			status: props.status,
			schedule:
				props.scheduledAt && props.status === "AGENDADA"
					? unsafeSchedule(props.scheduledAt)
					: null,
			publishedAt: props.publishedAt ?? null,
			firstPublishedAt: props.firstPublishedAt ?? null,
			rejectionReason: props.rejectionReason ?? null,
		});
	}

	// --- Consultas ------------------------------------------------------------

	get headline(): string {
		return this.state.headline.value;
	}

	get slug(): string {
		return this.state.slug.value;
	}

	get kicker(): string {
		return this.state.kicker.value;
	}

	get standfirst(): string {
		return this.state.standfirst.value;
	}

	get body(): Body {
		return this.state.body;
	}

	get byline(): Byline {
		return this.state.byline;
	}

	get sectionId(): string | null {
		return this.state.sectionId;
	}

	get tagIds(): readonly string[] {
		return this.state.tagIds;
	}

	get cover(): Cover | null {
		return this.state.cover;
	}

	get status(): EditorialStatus {
		return this.state.status;
	}

	get scheduledAt(): Date | null {
		return this.state.schedule ? this.state.schedule.at : null;
	}

	get publishedAt(): Date | null {
		return this.state.publishedAt;
	}

	/** Instante da PRIMEIRA publicação — sela a imutabilidade do slug. */
	get firstPublishedAt(): Date | null {
		return this.state.firstPublishedAt;
	}

	get rejectionReason(): string | null {
		return this.state.rejectionReason;
	}

	isPublished(): boolean {
		return (
			this.state.status === "PUBLICADA" || this.state.status === "ATUALIZADA"
		);
	}

	/**
	 * O que falta para publicar (A04). Lista para a UI mostrar antes do clique;
	 * vazia significa "pode publicar". Título e autor são garantidos na criação.
	 */
	publishPreflight(): PublishBlocker[] {
		const blockers: PublishBlocker[] = [];
		if (this.state.body.isEmpty()) {
			blockers.push(new BodyRequired());
		}
		if (!this.state.sectionId) {
			blockers.push(new SectionRequired());
		}
		if (!this.state.cover) {
			blockers.push(new CoverImageRequired());
		} else if (!this.state.cover.hasAltText()) {
			blockers.push(new AltTextRequired());
		}
		return blockers;
	}

	// --- Mutações ao conteúdo -------------------------------------------------

	/** Troca o slug — proibido depois da primeira publicação (URL não quebra). */
	changeSlug(raw: string): Result<void, InvalidSlug | SlugImmutable> {
		if (this.state.firstPublishedAt !== null) {
			return err(new SlugImmutable());
		}
		const slug = Slug.create(raw);
		if (slug.isErr()) {
			return err(slug.error);
		}
		this.state.slug = slug.value;
		return ok(undefined);
	}

	/**
	 * Edita o conteúdo (só os campos informados). O slug NÃO muda aqui — é o
	 * `changeSlug`, que impõe a imutabilidade. Matéria ARQUIVADA é imutável. A
	 * transição PUBLICADA → ATUALIZADA (com evento) é decidida pelo caso de uso
	 * via `markUpdated`, não aqui: editar o conteúdo é ortogonal ao estado.
	 */
	editContent(input: {
		headline?: string;
		kicker?: string | null;
		standfirst?: string | null;
		body?: readonly BlockInput[];
		sectionId?: string | null;
		tagIds?: readonly string[];
		cover?: { mediaId: string; altText?: string | null } | null;
		authorName?: string;
	}): Result<
		void,
		InvalidTransition | HeadlineRequired | InvalidBlock | BylineRequired
	> {
		if (this.state.status === "ARQUIVADA") {
			return err(new InvalidTransition("ARQUIVADA", "ARQUIVADA"));
		}
		if (input.headline !== undefined) {
			const headline = Headline.create(input.headline);
			if (headline.isErr()) {
				return err(headline.error);
			}
			this.state.headline = headline.value;
		}
		if (input.body !== undefined) {
			const body = Body.create(input.body);
			if (body.isErr()) {
				return err(body.error);
			}
			this.state.body = body.value;
		}
		if (input.authorName !== undefined) {
			const byline = Byline.create({
				authorId: this.state.byline.authorId,
				name: input.authorName,
			});
			if (byline.isErr()) {
				return err(byline.error);
			}
			this.state.byline = byline.value;
		}
		if (input.kicker !== undefined) {
			this.state.kicker = Kicker.create(input.kicker);
		}
		if (input.standfirst !== undefined) {
			this.state.standfirst = Standfirst.create(input.standfirst);
		}
		if (input.sectionId !== undefined) {
			this.state.sectionId = input.sectionId;
		}
		if (input.tagIds !== undefined) {
			this.state.tagIds = [...input.tagIds];
		}
		if (input.cover !== undefined) {
			this.state.cover = input.cover ? Cover.create(input.cover) : null;
		}
		return ok(undefined);
	}

	// --- Transições do workflow ----------------------------------------------

	submitForReview(now: Date): Result<void, InvalidTransition> {
		if (this.state.status !== "RASCUNHO") {
			return err(new InvalidTransition(this.state.status, "EM_REVISAO"));
		}
		this.state.status = "EM_REVISAO";
		this.record(new ArticleSubmittedForReview(this.id, now));
		return ok(undefined);
	}

	reject(
		reason: string,
		now: Date,
	): Result<void, InvalidTransition | RejectionReasonRequired> {
		if (this.state.status !== "EM_REVISAO") {
			return err(new InvalidTransition(this.state.status, "RASCUNHO"));
		}
		const trimmed = reason.trim();
		if (!trimmed) {
			return err(new RejectionReasonRequired());
		}
		this.state.status = "RASCUNHO";
		this.state.rejectionReason = trimmed;
		this.record(new ArticleRejected(this.id, trimmed, now));
		return ok(undefined);
	}

	approve(): Result<void, InvalidTransition> {
		if (this.state.status !== "EM_REVISAO") {
			return err(new InvalidTransition(this.state.status, "APROVADA"));
		}
		this.state.status = "APROVADA";
		this.state.rejectionReason = null;
		return ok(undefined);
	}

	schedule(
		at: Date,
		now: Date,
	): Result<void, InvalidTransition | ScheduleInPast | PublishBlocker> {
		if (this.state.status !== "APROVADA") {
			return err(new InvalidTransition(this.state.status, "AGENDADA"));
		}
		const blockers = this.publishPreflight();
		if (blockers.length > 0) {
			return err(blockers[0] as PublishBlocker);
		}
		const schedule = PublicationSchedule.create(at, now);
		if (schedule.isErr()) {
			return err(schedule.error);
		}
		this.state.status = "AGENDADA";
		this.state.schedule = schedule.value;
		this.record(new ArticleScheduled(this.id, at, now));
		return ok(undefined);
	}

	cancelSchedule(): Result<void, InvalidTransition> {
		if (this.state.status !== "AGENDADA") {
			return err(new InvalidTransition(this.state.status, "APROVADA"));
		}
		this.state.status = "APROVADA";
		this.state.schedule = null;
		return ok(undefined);
	}

	publish(now: Date): Result<void, InvalidTransition | PublishBlocker> {
		if (this.state.status !== "APROVADA" && this.state.status !== "AGENDADA") {
			return err(new InvalidTransition(this.state.status, "PUBLICADA"));
		}
		const blockers = this.publishPreflight();
		if (blockers.length > 0) {
			return err(blockers[0] as PublishBlocker);
		}
		// `sectionId` é garantido pelo preflight (SectionRequired); reconferido só
		// para o tipo.
		const sectionId = this.state.sectionId;
		/* v8 ignore next 3 -- inalcançável: o preflight acima já barra sem editoria */
		if (!sectionId) {
			return err(new SectionRequired());
		}
		this.state.status = "PUBLICADA";
		this.state.publishedAt = now;
		this.state.schedule = null;
		if (this.state.firstPublishedAt === null) {
			this.state.firstPublishedAt = now;
		}
		this.record(
			new ArticlePublished(this.id, this.state.slug.value, sectionId, now),
		);
		return ok(undefined);
	}

	/** Edição de matéria já publicada: vira ATUALIZADA e emite ArticleUpdated. */
	markUpdated(now: Date): Result<void, InvalidTransition> {
		if (
			this.state.status !== "PUBLICADA" &&
			this.state.status !== "ATUALIZADA"
		) {
			return err(new InvalidTransition(this.state.status, "ATUALIZADA"));
		}
		this.state.status = "ATUALIZADA";
		this.record(new ArticleUpdated(this.id, now));
		return ok(undefined);
	}

	/** Arquiva (nunca apaga) uma matéria publicada — integridade do acervo. */
	archive(now: Date): Result<void, InvalidTransition> {
		if (
			this.state.status !== "PUBLICADA" &&
			this.state.status !== "ATUALIZADA"
		) {
			return err(new InvalidTransition(this.state.status, "ARQUIVADA"));
		}
		this.state.status = "ARQUIVADA";
		this.record(new ArticleUnpublished(this.id, now));
		return ok(undefined);
	}
}

/**
 * Reidrata um agendamento persistido sem revalidar contra "agora" (o passado é
 * um fato; a validação de futuro é só na criação). Isola o `/* v8 ignore` num só
 * ponto.
 */
function unsafeSchedule(at: Date): PublicationSchedule {
	const far = new Date(at.getTime() - 1);
	const schedule = PublicationSchedule.create(at, far);
	/* v8 ignore next 3 -- `far` é sempre anterior a `at`, então nunca é erro */
	if (schedule.isErr()) {
		throw schedule.error;
	}
	return schedule.value;
}
